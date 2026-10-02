# Renders the cultivation cycle's four illustrations in Blender: one hanging straw bag, seen the same way at each
# stage, so the pictures change only where the bag does. Run on the Blender PC (see tools/diorama/blender-pc.sh):
#   blender-pc.sh script tools/cultivation/bag.py <stages> <samples> <version> [resolution %]
#   e.g. bag.py incubation,pinning,fruiting,harvest 160 v1 100
# Writes cultivation-<stage>-<version>.png (transparent background) into the PC's jobs folder.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector, noise

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
stages = args[0].split(',') if args else ['incubation', 'pinning', 'fruiting', 'harvest']
samples = int(args[1]) if len(args) > 1 else 128
version = args[2] if len(args) > 2 else 'v1'
percent = int(args[3]) if len(args) > 3 else 100
here = os.getcwd()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
UP = Vector((0, 0, 1))
# The camera looks from the front (negative y); caps turn their tops part of the way towards it.
VIEWER, TURN = Vector((0, -1, .35)).normalized(), math.radians(34)


def linear(hex_color):
    c = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def node(tree, kind, **props):
    n = tree.nodes.new(kind)
    for key, value in props.items():
        setattr(n, key, value)
    return n


def socket(sockets, name, kind):
    """A node socket by name and type: the Mix node has an A and a B for every data type."""
    return next(s for s in sockets if s.name == name and s.type == kind)


def ramp(tree, stops):
    r = node(tree, 'ShaderNodeValToRGB')
    elements = r.color_ramp.elements
    while len(elements) < len(stops):
        elements.new(0)
    for element, (position, color) in zip(elements, stops):
        element.position, element.color = position, (*linear(color), 1)
    return r


def principled(label, color, rough=.5, **inputs):
    m = bpy.data.materials.new(label)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*linear(color), 1)
    b.inputs['Roughness'].default_value = rough
    for name, value in inputs.items():
        b.inputs[name.replace('_', ' ')].default_value = value
    return m


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def place(obj, owner):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    owner.objects.link(obj)
    return obj


def smooth(obj, level=0):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if level:
        subsurf = obj.modifiers.new('Smooth', 'SUBSURF')
        subsurf.levels = subsurf.render_levels = level
    return obj


def frame(forward, side, up):
    return Matrix(((forward.x, side.x, up.x, 0), (forward.y, side.y, up.y, 0), (forward.z, side.z, up.z, 0), (0, 0, 0, 1)))


# Mycelium -------------------------------------------------------------------------------------------------
# One field of white growth shared by the straw and the gaps between it: where the field rises above a
# threshold the mycelium has arrived. Lowering every threshold together spreads it from stage to stage.
thresholds = []


def mycelium_mix(tree, surface, bias=0.0):
    """Blends `surface` (a BSDF socket) with soft white mycelium wherever the shared field has reached."""
    geometry = node(tree, 'ShaderNodeNewGeometry')
    fine, broad = node(tree, 'ShaderNodeTexNoise'), node(tree, 'ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value, fine.inputs['Detail'].default_value, fine.inputs['Roughness'].default_value = 20, 8, .62
    broad.inputs['Scale'].default_value, broad.inputs['Detail'].default_value = 4, 3
    for n in (fine, broad):
        tree.links.new(geometry.outputs['Position'], n.inputs['Vector'])
    field = node(tree, 'ShaderNodeMix', data_type='FLOAT')
    socket(field.inputs, 'Factor', 'VALUE').default_value = .25
    tree.links.new(fine.outputs['Fac'], socket(field.inputs, 'A', 'VALUE'))
    tree.links.new(broad.outputs['Fac'], socket(field.inputs, 'B', 'VALUE'))
    threshold = node(tree, 'ShaderNodeValue')
    threshold.outputs[0].default_value = .5
    thresholds.append((threshold, bias))
    low, high = node(tree, 'ShaderNodeMath', operation='SUBTRACT'), node(tree, 'ShaderNodeMath', operation='ADD')
    for n in (low, high):
        tree.links.new(threshold.outputs[0], n.inputs[0])
        n.inputs[1].default_value = .035
    mask = node(tree, 'ShaderNodeMapRange')
    tree.links.new(socket(field.outputs, 'Result', 'VALUE'), mask.inputs['Value'])
    tree.links.new(low.outputs[0], mask.inputs['From Min'])
    tree.links.new(high.outputs[0], mask.inputs['From Max'])
    fuzz = node(tree, 'ShaderNodeTexNoise')
    fuzz.inputs['Scale'].default_value = 1400
    tree.links.new(geometry.outputs['Position'], fuzz.inputs['Vector'])
    bump = node(tree, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = .3
    tree.links.new(fuzz.outputs['Fac'], bump.inputs['Height'])
    white = node(tree, 'ShaderNodeBsdfPrincipled')
    white.inputs['Base Color'].default_value = (*linear('#f2eee5'), 1)
    white.inputs['Roughness'].default_value = .9
    white.inputs['Subsurface Weight'].default_value = .2
    white.inputs['Sheen Weight'].default_value = .9
    white.inputs['Sheen Roughness'].default_value = .45
    tree.links.new(bump.outputs['Normal'], white.inputs['Normal'])
    mix = node(tree, 'ShaderNodeMixShader')
    tree.links.new(mask.outputs['Result'], mix.inputs['Fac'])
    tree.links.new(surface, mix.inputs[1])
    tree.links.new(white.outputs['BSDF'], mix.inputs[2])
    return mix.outputs['Shader']


def set_spread(threshold):
    for value, bias in thresholds:
        value.outputs[0].default_value = threshold - bias


def straw_material():
    """Golden pieces of chopped straw, each its own shade, with fine fibres along its length."""
    m = bpy.data.materials.new('straw')
    m.use_nodes = True
    t = m.node_tree
    out, b = t.nodes['Material Output'], t.nodes['Principled BSDF']
    grain = node(t, 'ShaderNodeAttribute', attribute_name='grain')
    tone = ramp(t, [(0, '#a97b36'), (.35, '#c99d55'), (.75, '#ddbb76'), (1, '#e9cf93')])
    t.links.new(grain.outputs['Fac'], tone.inputs['Fac'])
    uv = node(t, 'ShaderNodeUVMap')
    fibres = node(t, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y')
    fibres.inputs['Scale'].default_value = 5
    fibres.inputs['Distortion'].default_value = 1.5
    fibres.inputs['Detail'].default_value = 2
    t.links.new(uv.outputs['UV'], fibres.inputs['Vector'])
    lines = node(t, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    socket(lines.inputs, 'Factor', 'VALUE').default_value = .22
    t.links.new(tone.outputs['Color'], socket(lines.inputs, 'A', 'RGBA'))
    t.links.new(fibres.outputs['Color'], socket(lines.inputs, 'B', 'RGBA'))
    t.links.new(socket(lines.outputs, 'Result', 'RGBA'), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .55
    b.inputs['Sheen Weight'].default_value = .25
    bump = node(t, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = .35
    t.links.new(fibres.outputs['Fac'], bump.inputs['Height'])
    t.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    t.links.new(mycelium_mix(t, b.outputs['BSDF']), out.inputs['Surface'])
    return m


def core_material():
    """The packed depths between the pieces: dark, and the first place the mycelium fills."""
    m = principled('substrate depths', '#3a2a17', .9)
    t = m.node_tree
    t.links.new(mycelium_mix(t, t.nodes['Principled BSDF'].outputs['BSDF'], bias=.09), t.nodes['Material Output'].inputs['Surface'])
    return m


def cap_material():
    """An oyster cap: grey-brown, darkest where it joins the stem, paler towards the margin, with faint streaks."""
    m = bpy.data.materials.new('cap')
    m.use_nodes = True
    t = m.node_tree
    b = t.nodes['Principled BSDF']
    uv = node(t, 'ShaderNodeUVMap')
    split = node(t, 'ShaderNodeSeparateXYZ')
    t.links.new(uv.outputs['UV'], split.inputs['Vector'])
    colour = ramp(t, [(0, '#302c27'), (.3, '#4f473f'), (.75, '#6e6457'), (1, '#8f8474')])
    t.links.new(split.outputs['X'], colour.inputs['Fac'])
    streaks = node(t, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y')
    streaks.inputs['Scale'].default_value = 26
    streaks.inputs['Distortion'].default_value = 5
    t.links.new(uv.outputs['UV'], streaks.inputs['Vector'])
    soft = node(t, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    socket(soft.inputs, 'Factor', 'VALUE').default_value = .1
    t.links.new(colour.outputs['Color'], socket(soft.inputs, 'A', 'RGBA'))
    t.links.new(streaks.outputs['Color'], socket(soft.inputs, 'B', 'RGBA'))
    t.links.new(socket(soft.outputs, 'Result', 'RGBA'), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .5
    b.inputs['Subsurface Weight'].default_value = .06
    b.inputs['Sheen Weight'].default_value = .1
    return m


def gill_material():
    """The underside: cream gills running from the margin down into the stem."""
    m = bpy.data.materials.new('gills')
    m.use_nodes = True
    t = m.node_tree
    b = t.nodes['Principled BSDF']
    uv = node(t, 'ShaderNodeUVMap')
    lines = node(t, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y')
    lines.inputs['Scale'].default_value = 40
    t.links.new(uv.outputs['UV'], lines.inputs['Vector'])
    colour = ramp(t, [(0, '#c9b9a0'), (.5, '#eae0cd'), (1, '#f5ede0')])
    t.links.new(lines.outputs['Fac'], colour.inputs['Fac'])
    t.links.new(colour.outputs['Color'], b.inputs['Base Color'])
    bump = node(t, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = .6
    t.links.new(lines.outputs['Fac'], bump.inputs['Height'])
    t.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = .75
    b.inputs['Subsurface Weight'].default_value = .2
    return m


def plastic_material():
    """Thin clear plastic: mostly see-through, softly creased, with gentle highlights rather than a glassy shine."""
    m = principled('plastic', '#ffffff', .1, IOR=1.22, Transmission_Weight=1.0, Specular_IOR_Level=.3)
    t = m.node_tree
    coord = node(t, 'ShaderNodeTexCoord')
    stretch = node(t, 'ShaderNodeMapping')
    stretch.inputs['Scale'].default_value = (30, 30, 5)
    t.links.new(coord.outputs['Object'], stretch.inputs['Vector'])
    creases = node(t, 'ShaderNodeTexNoise')
    creases.inputs['Detail'].default_value = 4
    t.links.new(stretch.outputs['Vector'], creases.inputs['Vector'])
    bump = node(t, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = .18
    t.links.new(creases.outputs['Fac'], bump.inputs['Height'])
    t.links.new(bump.outputs['Normal'], t.nodes['Principled BSDF'].inputs['Normal'])
    return m


def shadow_material():
    """A soft contact shadow painted onto a transparent plane, darkest at its middle."""
    m = bpy.data.materials.new('contact shadow')
    m.use_nodes = True
    t = m.node_tree
    out = t.nodes['Material Output']
    t.nodes.remove(t.nodes['Principled BSDF'])
    coord = node(t, 'ShaderNodeTexCoord')
    fit = node(t, 'ShaderNodeMapping')
    # The plane's own coordinates run from -0.5 to 0.5: the shadow fades to nothing at its edges.
    fit.inputs['Scale'].default_value = (2, 2, 1)
    t.links.new(coord.outputs['Object'], fit.inputs['Vector'])
    gradient = node(t, 'ShaderNodeTexGradient', gradient_type='SPHERICAL')
    t.links.new(fit.outputs['Vector'], gradient.inputs['Vector'])
    strength = ramp(t, [(0, '#000000'), (1, '#6b6b6b')])
    t.links.new(gradient.outputs['Fac'], strength.inputs['Fac'])
    clear, dark = node(t, 'ShaderNodeBsdfTransparent'), node(t, 'ShaderNodeBsdfDiffuse')
    dark.inputs['Color'].default_value = (*linear('#2e2519'), 1)
    mix = node(t, 'ShaderNodeMixShader')
    t.links.new(strength.outputs['Color'], mix.inputs['Fac'])
    t.links.new(clear.outputs['BSDF'], mix.inputs[1])
    t.links.new(dark.outputs['BSDF'], mix.inputs[2])
    t.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


mats = {
    'straw': straw_material(),
    'core': core_material(),
    'plastic': plastic_material(),
    'twine': principled('twine', '#c2a57a', .9),
    'cap': cap_material(),
    'gills': gill_material(),
    'stem': principled('stem', '#ede4d3', .6, Subsurface_Weight=.25),
    'knot': principled('mycelium knot', '#f3efe6', .9, Subsurface_Weight=.2, Sheen_Weight=.9),
    'pin': principled('pin tip', '#69707a', .5, Subsurface_Weight=.15),
    'cut': principled('cut mark', '#3e2f22', .7),
    'cut face': principled('cut face', '#e6d8bd', .7),
    'dish': principled('dish', '#ebe5d8', .3, Coat_Weight=.4),
    'shadow': shadow_material(),
}

# The bag ------------------------------------------------------------------------------------------------
RADIUS, HEIGHT = .082, .44
TIE = HEIGHT + .055


def core_radius(z):
    """The packed straw's outline: a rounded bottom, slightly fuller low down, rounded shoulders at the top."""
    if z <= 0 or z >= HEIGHT:
        return 0.0
    if z < .045:
        k = (.045 - z) / .045
        return RADIUS * math.sqrt(max(0, 1 - k * k))
    if z > HEIGHT - .04:
        k = (z - HEIGHT + .04) / .04
        return RADIUS * .96 * math.sqrt(max(0, 1 - k * k))
    return RADIUS * (1.0 - .04 * (z - .045) / (HEIGHT - .085))


def lathe(name, rings, segments=144, radial=None):
    """A surface of revolution through (radius, height) rings; `radial(theta, z)` scales each point outwards."""
    bm = bmesh.new()
    grid = []
    for r, z in rings:
        row = []
        for i in range(segments):
            theta = 2 * math.pi * i / segments
            rr = r * (radial(theta, z) if radial else 1)
            row.append(bm.verts.new((rr * math.sin(theta), -rr * math.cos(theta), z)))
        grid.append(row)
    for a, b in zip(grid, grid[1:]):
        for i in range(segments):
            bm.faces.new((a[i], a[(i + 1) % segments], b[(i + 1) % segments], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


core = lathe('substrate', [(max(.001, core_radius(z)), z) for z in (i / 200 * HEIGHT for i in range(201))])
core.data.materials.append(mats['core'])
smooth(core)


def straw(count, rng):
    """Flat ribbons of chopped straw over the packed core, in every direction and a few layers deep."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grain = bm.faces.layers.float.new('grain')
    for _ in range(count):
        z = rng.uniform(.006, HEIGHT - .006)
        r0 = core_radius(z)
        if r0 < .012:
            continue
        theta = rng.uniform(0, 2 * math.pi)
        slope = (core_radius(z + .002) - core_radius(z - .002)) / .004
        outward = Vector((math.sin(theta), -math.cos(theta), 0))
        n = (outward - UP * slope).normalized()
        around = Vector((math.cos(theta), math.sin(theta), 0))
        upward = n.cross(around).normalized()
        if upward.z < 0:
            upward = -upward
        angle = rng.uniform(0, math.pi)
        along = around * math.cos(angle) + upward * math.sin(angle)
        across = n.cross(along).normalized()
        centre = Vector((r0 * math.sin(theta), -r0 * math.cos(theta), z)) + n * rng.uniform(.0006, .0038)
        length, width = rng.uniform(.012, .038), rng.uniform(.0022, .0048)
        lift, twist, shade = rng.uniform(-.002, .002), rng.uniform(-.7, .7), rng.random()
        rows, segments = [], 5
        for i in range(segments + 1):
            s = i / segments - .5
            # Follow the bag's curve around its middle, with one end lifted a little off the pile.
            sideways = s * length * along.dot(around)
            c = centre + along * (s * length) - n * (sideways * sideways / (2 * r0)) + n * (lift * s * 2)
            w = across * math.cos(twist * s) + n * math.sin(twist * s)
            rows.append((bm.verts.new(c - w * width / 2), bm.verts.new(c + w * width / 2)))
        for i in range(segments):
            face = bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
            for loop_, coords in zip(face.loops, ((i / segments, 0), ((i + 1) / segments, 0), ((i + 1) / segments, 1), (i / segments, 1))):
                loop_[uv].uv = coords
            face[grain] = shade
    mesh = bpy.data.meshes.new('straw')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('straw', mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mats['straw'])
    return obj


straw(7500, random.Random(3))


def plastic_radius(z):
    if z <= HEIGHT - .012:
        return core_radius(max(z, .0005)) + .0078
    if z <= TIE:
        k = (z - HEIGHT + .012) / (TIE - HEIGHT + .012)
        start = core_radius(HEIGHT - .012) + .0078
        return .0095 + (start - .0095) * (1 - k) ** 1.7
    # Above the tie the plastic opens into a small crumpled tuft.
    k = min(1, (z - TIE) / .032)
    return .0095 + .019 * math.sin(k * math.pi / 2)


def gathered(theta, z):
    """Deep folds where the plastic is gathered to the tie, crumpled at the tuft, faint creases over the body."""
    if z > HEIGHT - .025:
        lean = min(1, (z - HEIGHT + .025) / .03)
        crumple = 1.8 if z > TIE else 1.0
        wave = math.sin(22 * theta + 4 * noise.noise(Vector((theta * 2, z * 40, 1))))
        return 1 + .16 * lean * crumple * wave
    return 1 + .01 * noise.noise(Vector((math.sin(theta) * 4, math.cos(theta) * 4, z * 12)))


plastic = lathe('plastic', [(max(.001, plastic_radius(z)), z) for z in (i / 260 * (TIE + .032) for i in range(261))], radial=gathered)
plastic.data.materials.append(mats['plastic'])
plastic.modifiers.new('Shell', 'SOLIDIFY').thickness = .0005
smooth(plastic, 1)

# Twine wrapped three times round the neck, and the loop the bag hangs from.
for dz in (-.0035, 0, .0035):
    bpy.ops.mesh.primitive_torus_add(major_radius=.0118, minor_radius=.0024, major_segments=48, minor_segments=12, location=(0, 0, TIE + dz))
    bpy.context.active_object.data.materials.append(mats['twine'])
    smooth(bpy.context.active_object)
loop = bpy.data.curves.new('loop', 'CURVE')
loop.dimensions, loop.bevel_depth, loop.bevel_resolution = '3D', .0021, 4
spline = loop.splines.new('NURBS')
points = [(-.006, -.008, TIE), (-.017, -.01, TIE + .04), (-.009, -.006, TIE + .085), (.009, -.006, TIE + .085), (.017, -.004, TIE + .04), (.006, -.008, TIE)]
spline.points.add(len(points) - 1)
for p, co in zip(spline.points, points):
    p.co = (*co, 1)
spline.use_endpoint_u, spline.order_u = True, 4
loop_obj = bpy.data.objects.new('loop', loop)
scene.collection.objects.link(loop_obj)
loop.materials.append(mats['twine'])

# Openings ---------------------------------------------------------------------------------------------
# Where the plastic is cut for fruiting: (angle from the front, height). Right upper, left middle, right lower.
openings = [(math.radians(64), .33), (math.radians(-62), .21), (math.radians(30), .095)]


def surface(theta, z, out=0.0):
    r = plastic_radius(z) * gathered(theta, z) + out
    return Vector((r * math.sin(theta), -r * math.cos(theta), z)), Vector((math.sin(theta), -math.cos(theta), 0))


def cut_marks(owner):
    for theta, z in openings:
        p, n = surface(theta, z, .001)
        side = UP.cross(n).normalized()
        for angle in (45, -45):
            bpy.ops.mesh.primitive_cube_add(size=1)
            mark = bpy.context.active_object
            mark.scale = (.0008, .028, .0016)
            bpy.ops.object.transform_apply(scale=True)
            mark.matrix_world = Matrix.Translation(p) @ frame(n, side, UP) @ Matrix.Rotation(math.radians(angle), 4, 'X')
            mark.data.materials.append(mats['cut'])
            place(mark, owner)


def blob(owner, at, normal, size, material='knot'):
    """A soft white knot of mycelium bulging from an opening."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12, location=at)
    knot = bpy.context.active_object
    side = UP.cross(normal).normalized()
    knot.matrix_world = Matrix.Translation(at) @ frame(normal, side, UP) @ Matrix.Diagonal((size * .5, size, size * .8, 1))
    knot.data.materials.append(mats[material])
    return place(smooth(knot, 1), owner)


def stem(owner, start, end, radius, sag=0.0):
    curve = bpy.data.curves.new('stem', 'CURVE')
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution, curve.use_fill_caps = '3D', 1, 6, True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(1)
    a, b = spline.bezier_points
    a.co, b.co = start, end
    a.radius, b.radius = radius * 1.2, radius * .85
    a.handle_left_type = a.handle_right_type = b.handle_left_type = b.handle_right_type = 'FREE'
    mid = (start + end) / 2 - UP * sag
    a.handle_right, b.handle_left = start.lerp(mid, .7), end.lerp(mid, .7)
    a.handle_left, b.handle_right = start * 2 - a.handle_right, end * 2 - b.handle_left
    obj = bpy.data.objects.new('stem', curve)
    owner.objects.link(obj)
    curve.materials.append(mats['stem'])
    return obj


def cap(owner, origin, forward, size, rng):
    """One oyster cap: a wide shell-shaped fan opening from where it joins its stem, its wavy margin curling under."""
    spread, nu, nv = math.radians(rng.uniform(98, 128)), 12, 40
    height = size * rng.uniform(.26, .34)
    phase = [rng.uniform(0, 6.3) for _ in range(3)]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grid = []
    for i in range(nu + 1):
        u = i / nu
        row = []
        for j in range(nv + 1):
            v = -spread + 2 * spread * j / nv
            reach = size * (1 + .09 * math.sin(4 * v + phase[0]) + .045 * math.sin(10 * v + phase[1]))
            rho = reach * (.04 + .96 * u)
            z = height * (1.2 * math.sin(math.pi * .55 * u) - 1.0 * u ** 3) + .035 * size * u * u * math.sin(6 * v + phase[2])
            z -= height * .25 * max(0, 1 - u / .22)
            z -= height * .4 * (abs(v) / spread) ** 2 * u
            row.append(bm.verts.new((rho * math.cos(v), rho * math.sin(v), z)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            face = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for loop_, (a, b) in zip(face.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop_[uv].uv = (a / nu, b / nv)
    mesh = bpy.data.meshes.new('cap')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('cap', mesh)
    owner.objects.link(obj)
    obj.data.materials.append(mats['cap'])
    obj.data.materials.append(mats['gills'])
    flesh = obj.modifiers.new('Flesh', 'SOLIDIFY')
    flesh.thickness, flesh.offset, flesh.material_offset = height * .5, -1, 1
    smooth(obj, 1)
    # The fan opens outwards and a little upwards; its top turns towards the sky and partly towards the viewer,
    # as caps on a hanging bag face the room.
    f = (forward + UP * rng.uniform(.08, .25)).normalized()
    facing = VIEWER - f * VIEWER.dot(f)
    u = (UP - f * UP.dot(f)).normalized()
    if facing.length > 1e-4:
        u = (u * math.cos(TURN) + facing.normalized() * math.sin(TURN)).normalized()
    f = (f - u * u.dot(f)).normalized()
    obj.matrix_world = Matrix.Translation(origin) @ frame(f, u.cross(f), u)
    return obj


def cluster(owner, base, normal, count, rng, largest, smallest, pitch=(-6, 30)):
    """A bouquet of oyster caps from one opening: short stout stems from a shared knot, the caps fanning out
    sideways and upwards, the largest in the middle."""
    side = UP.cross(normal).normalized()
    blob(owner, base, normal, .012, 'stem')
    for k in range(count):
        yaw = rng.uniform(-1, 1) * math.radians(68)
        tilt = math.radians(rng.uniform(*pitch))
        out = normal * math.cos(yaw) + side * math.sin(yaw)
        out = (out * math.cos(tilt) + UP * math.sin(tilt)).normalized()
        size = largest - (largest - smallest) * (abs(yaw) / 1.19) * .8 - rng.uniform(0, .005)
        length = .008 + .012 * rng.random()
        joint = base + out * length + UP * rng.uniform(-.012, .022)
        stem(owner, base + normal * .002, joint, .0048 + size * .075, sag=.002)
        cap(owner, joint, out, size, rng)


def pins(owner, base, normal, rng, count=56):
    """Primordia: a crowd of tiny pale knobs with grey-blue tips, pushing out of a white knot at the opening."""
    side = UP.cross(normal).normalized()
    blob(owner, base + normal * .003, normal, .024)
    for _ in range(count):
        a, d = rng.uniform(0, 6.283), .019 * math.sqrt(rng.random())
        p = base + normal * .009 + side * math.cos(a) * d + UP * math.sin(a) * d * .8
        direction = (normal + side * rng.uniform(-.4, .4) + UP * rng.uniform(-.15, .5)).normalized()
        length, radius = rng.uniform(.004, .012), rng.uniform(.0019, .0032)
        stem(owner, p, p + direction * length, radius)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius * 1.6, segments=16, ring_count=8, location=p + direction * length)
        tip = bpy.context.active_object
        tip.scale = (1, 1, .72)
        tip.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
        tip.data.materials.append(mats['pin'])
        place(smooth(tip), owner)


def stubs(owner, base, normal, rng, count=5):
    """What the harvest leaves: short stems cut flat at the opening."""
    side = UP.cross(normal).normalized()
    blob(owner, base, normal, .016, 'stem')
    for _ in range(count):
        p = base + side * rng.uniform(-.012, .012) + UP * rng.uniform(-.008, .012)
        direction = (normal + UP * rng.uniform(.05, .4) + side * rng.uniform(-.35, .35)).normalized()
        radius, length = rng.uniform(.0065, .01), rng.uniform(.01, .018)
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, vertices=24, location=p + direction * length / 2)
        s = bpy.context.active_object
        s.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
        s.data.materials.append(mats['stem'])
        s.data.materials.append(mats['cut face'])
        for polygon in s.data.polygons:
            if polygon.normal.z > .5:
                polygon.material_index = 1
        place(smooth(s), owner)


# Each stage's own pieces ------------------------------------------------------------------------------
groups = {name: collection(name) for name in ('openings', 'pinning', 'fruiting', 'harvest')}
cut_marks(groups['openings'])
rng = random.Random(7)
for (theta, z), (count, largest, smallest) in zip(openings, ((11, .066, .03), (10, .06, .028), (7, .05, .026))):
    base, n = surface(theta, z, .0015)
    pins(groups['pinning'], base, n, rng)
    cluster(groups['fruiting'], base, n, count, rng, largest, smallest)
    stubs(groups['harvest'], base, n, rng)

# The harvest, gathered in a shallow dish below the bag, with a soft shadow beneath it.
DISH = Vector((-.012, -.19, -.075))
profile = [(.001, 0), (.075, 0), (.097, .006), (.117, .024), (.125, .037), (.128, .04)]
dish = lathe('dish', [(r, z) for r, z in profile], segments=96)
dish.location = DISH
dish.data.materials.append(mats['dish'])
dish.modifiers.new('Shell', 'SOLIDIFY').thickness = .004
place(smooth(dish, 1), groups['harvest'])
harvest_rng = random.Random(11)
for offset, heading, count in (((-.026, .014), -.5, 7), ((.032, -.01), 2.5, 6)):
    base = DISH + Vector((offset[0], offset[1], .022))
    n = Vector((math.cos(heading), math.sin(heading), .55)).normalized()
    # Cut clusters lie in the dish with their caps turned up, inside its rim.
    cluster(groups['harvest'], base, n, count, harvest_rng, .046, .026, pitch=(15, 45))
bpy.ops.mesh.primitive_plane_add(size=1, location=DISH - Vector((0, 0, .0005)))
shadow = bpy.context.active_object
shadow.scale = (.3, .21, 1)
shadow.data.materials.append(mats['shadow'])
place(shadow, groups['harvest'])

# Studio -----------------------------------------------------------------------------------------------
world = bpy.data.worlds.new('studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (*linear('#f5eee3'), 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .4
# Reflections see a bright white studio, so clear plastic catches white highlights instead of grey edges.
wt = world.node_tree
bright, path, mix_world = wt.nodes.new('ShaderNodeBackground'), wt.nodes.new('ShaderNodeLightPath'), wt.nodes.new('ShaderNodeMixShader')
bright.inputs['Color'].default_value, bright.inputs['Strength'].default_value = (1, 1, 1, 1), 1.6
wt.links.new(path.outputs['Is Glossy Ray'], mix_world.inputs['Fac'])
wt.links.new(wt.nodes['Background'].outputs['Background'], mix_world.inputs[1])
wt.links.new(bright.outputs['Background'], mix_world.inputs[2])
wt.links.new(mix_world.outputs['Shader'], wt.nodes['World Output'].inputs['Surface'])
scene.world = world
centre = Vector((0, 0, .23))
for label, offset, size, energy, color in (('key', (-1.1, -1.3, 1.2), 1.1, 125, '#fff2e0'), ('fill', (1.3, -1.1, .4), 1.4, 42, '#eef2f5'), ('rim', (.5, 1.4, 1.1), .8, 80, '#fff8ee')):
    light = bpy.data.lights.new(label, 'AREA')
    light.size, light.energy, light.color = size, energy, linear(color)
    obj = bpy.data.objects.new(label, light)
    scene.collection.objects.link(obj)
    obj.location = centre + Vector(offset)
    obj.rotation_euler = (centre - obj.location).to_track_quat('-Z', 'Y').to_euler()

camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
scene.collection.objects.link(camera)
camera.data.type, camera.data.ortho_scale = 'ORTHO', .8
elevation = math.radians(10)
camera.location = centre + Vector((0, -math.cos(elevation), math.sin(elevation))) * 4
camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1040, 1440, percent
scene.render.film_transparent = True
# Clear plastic over nothing shows the page behind it, not the studio's grey.
scene.cycles.film_transparent_glass, scene.cycles.film_transparent_roughness = True, .2

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = 'GPU'
            break
    except TypeError:
        continue
print('DEVICE', scene.cycles.device)
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = scene.cycles.transmission_bounces = 16
scene.view_settings.view_transform = 'AgX'
for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        continue
print('LOOK', scene.view_settings.look)
scene.render.image_settings.file_format, scene.render.image_settings.color_mode = 'PNG', 'RGBA'

# How far the mycelium has spread (a lower threshold covers more), and which pieces show, at each stage.
looks = {
    'incubation': (.56, ()),
    'pinning': (.42, ('openings', 'pinning')),
    'fruiting': (.4, ('openings', 'fruiting')),
    'harvest': (.4, ('openings', 'harvest')),
}
for stage in stages:
    threshold, shown = looks[stage]
    set_spread(threshold)
    for name, group in groups.items():
        group.hide_render = name not in shown
    scene.render.filepath = os.path.join(here, f'cultivation-{stage}-{version}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
