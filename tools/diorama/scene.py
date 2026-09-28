# Builds a connected-system diorama in Blender from the site's layout data (tools/diorama/layout-json.mjs),
# then either renders a studio preview from the site's camera, or bakes the studio light of everything that
# stays still and exports the model for the live site. Run on the Blender PC through blender-pc.sh:
#   blender-pc.sh run scene.py observe-wide.json preview <samples> <done|mid> <version>
#   blender-pc.sh run scene.py observe-wide.json bake <samples> <atlas size>
# Axes: the site uses three.js (x down-right on screen, y up, z down-left); Blender is Z-up, so X = x, Y = -z, Z = y.
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
layout = json.load(open(args[0]))
mode = args[1] if len(args) > 1 else 'preview'
bake = mode == 'bake'
here = os.getcwd()
name = f"{layout['pathway']}-{layout['layout']}"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TOP = .42


def V(x, y, z):
    return Vector((x, -z, y))


def site(point):
    """A Blender point in the site's three.js coordinates."""
    return [round(point.x, 4), round(point.z, 4), round(-point.y, 4)]


def linear(hex_color):
    c = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def material(label, color, rough=.6, metal=0.0, coat=0.0, sss=0.0, transmission=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(label)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*linear(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Subsurface Weight'].default_value = sss
    b.inputs['Transmission Weight'].default_value = transmission
    if emit:
        b.inputs['Emission Color'].default_value = (*linear(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


fonts = {weight: bpy.data.fonts.load(os.path.join(here, f'dm-sans-{number}.ttf')) for weight, number in (('regular', 400), ('medium', 500))}


def flat(label, color):
    """Labels read like the site's text: flat colour, untouched by the studio light."""
    m = bpy.data.materials.new(label)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    nodes.remove(nodes['Principled BSDF'])
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (*linear(color), 1)
    m.node_tree.links.new(emission.outputs[0], nodes['Material Output'].inputs['Surface'])
    return m


def clear_shadows(m):
    """Glass lets light through: shadow rays pass the surface instead of darkening what lies behind."""
    nodes, links = m.node_tree.nodes, m.node_tree.links
    output, surface = nodes['Material Output'], nodes['Principled BSDF']
    path, clear, mix = nodes.new('ShaderNodeLightPath'), nodes.new('ShaderNodeBsdfTransparent'), nodes.new('ShaderNodeMixShader')
    links.new(path.outputs['Is Shadow Ray'], mix.inputs['Fac'])
    links.new(surface.outputs[0], mix.inputs[1])
    links.new(clear.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    return m


mats = {
    'base': material('platform base', '#e8dbc4', .78),
    'acrylic': material('frosted acrylic', '#f8f4ec', .32, coat=.35, sss=.25),
    'tile': material('tile plastic', '#fbfaf6', .28, coat=.6),
    'glass box': clear_shadows(material('glass box', '#fdfcfa', .06, coat=.4, transmission=1)),
    'ink': material('ink', '#2e3b36', .45),
    'metal': material('brushed aluminium', '#dadde0', .26, metal=1),
    'dark metal': material('dark aluminium', '#a9aeb1', .3, metal=1),
    'glass': clear_shadows(material('glass', '#ffffff', .12, transmission=1)),
    # The energy travelling the tubes (and the gate's inner edge) is burnt orange; TimescaleDB lights up deep teal.
    'core': material('energy', '#B95C2A', .4, emit='#B95C2A', strength=2.4),
    'glow': material('gate glow', '#B95C2A', .4, emit='#B95C2A', strength=2.4),
    # Mosquitto's gate: deep teal enamel with cream lettering.
    'enamel': material('teal enamel', '#1D302F', .3, coat=.7),
    'cream': material('cream lettering', '#f5efe3', .4),
    'seam': material('database light', '#1D302F', .4, emit='#1D302F', strength=3.5),
    'seam idle': material('database seam', '#cfc8bb', .5),
    'screen': material('screen', '#1f2c28', .35),
    'chart': material('chart line', '#B95C2A', .5, emit='#B95C2A', strength=9),
    'python blue': material('python blue', '#3776AB', .35, coat=.4),
    'python yellow': material('python yellow', '#FFD43B', .35, coat=.4),
    'ground': material('studio floor', '#f1e8da', .92),
    'label': flat('label', '#24332f'),
    'label detail': flat('label detail', '#34401f'),
}


def tag(obj, role):
    """What becomes of an object: 'baked' into the light texture, 'wheel' (baked, but turns), 'live:<name>'
    exported for the site to animate, or 'preview' (only in studio renders)."""
    obj['role'] = role
    return obj


def text(body, size, weight, mat, align_x='CENTER', align_y='TOP'):
    curve = bpy.data.curves.new('label', 'FONT')
    curve.body, curve.font, curve.size = body, fonts[weight], size
    curve.align_x, curve.align_y = align_x, align_y
    curve.materials.append(mats[mat])
    obj = bpy.data.objects.new(body, curve)
    scene.collection.objects.link(obj)
    return obj


def finish(obj, mat, bevel=0.0, segments=6):
    obj.data.materials.append(mats[mat])
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments, mod.limit_method, mod.harden_normals = bevel, segments, 'ANGLE', True
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def box(label, size, at, mat, bevel=.08, segments=6):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.active_object
    obj.name = label
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, mat, bevel, segments)


def cylinder(label, radius, depth, at, mat, bevel=.03, vertices=64, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=at, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = label
    return finish(obj, mat, bevel, 4)


def group(label, at, rotation=0.0):
    empty = bpy.data.objects.new(label, None)
    scene.collection.objects.link(empty)
    empty.location = at
    empty.rotation_euler = (0, 0, rotation)
    return empty


def parent(child, owner):
    child.parent = owner
    return child


# Parts --------------------------------------------------------------------------------------------

def platform(part, at):
    s = part['size']
    root = group(f"{part['id']} platform", at)
    tag(parent(box('base', (s, s, .3), (0, 0, .15), 'base', .1), root), 'baked').location = (0, 0, .15)
    tag(parent(box('acrylic top', (s * .86, s * .86, .12), (0, 0, 0), 'acrylic', .06), root), 'baked').location = (0, 0, .36)
    return root


def import_svg(svg):
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=os.path.join(here, svg))
    curves = [o for o in bpy.data.objects if o not in before and o.type == 'CURVE']
    for obj in bpy.data.objects:
        obj.select_set(obj in curves)
    bpy.context.view_layer.objects.active = curves[0]
    if len(curves) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.data.dimensions, obj.data.fill_mode = '2D', 'BOTH'
    obj.data.materials.clear()
    return obj


def fill_material(label, color, level, bottom, top, downwards=False):
    """The inside of an icon: coloured up to `level` (0-1 of the icon's height, measured between `bottom` and
    `top` in the icon's own units), pale glass above it. Filling downwards starts from the top, like writing a page."""
    m = bpy.data.materials.new(label)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    full = nodes['Principled BSDF']
    full.inputs['Base Color'].default_value = (*linear(color), 1)
    full.inputs['Roughness'].default_value = .35
    full.inputs['Emission Color'].default_value = (*linear(color), 1)
    full.inputs['Emission Strength'].default_value = .45
    empty = nodes.new('ShaderNodeBsdfPrincipled')
    empty.inputs['Base Color'].default_value = (*linear('#f4f1ea'), 1)
    empty.inputs['Roughness'].default_value = .3
    empty.inputs['Transmission Weight'].default_value = .35
    coord, split, test, mix = nodes.new('ShaderNodeTexCoord'), nodes.new('ShaderNodeSeparateXYZ'), nodes.new('ShaderNodeMath'), nodes.new('ShaderNodeMixShader')
    test.operation = 'GREATER_THAN' if downwards else 'LESS_THAN'
    height = top - bottom
    test.inputs[1].default_value = top - level * height if downwards else bottom + level * height
    links.new(coord.outputs['Object'], split.inputs[0])
    links.new(split.outputs['Y'], test.inputs[0])
    links.new(test.outputs[0], mix.inputs['Fac'])
    links.new(empty.outputs[0], mix.inputs[1])
    links.new(full.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes['Material Output'].inputs['Surface'])
    return m


def python_badge(owner):
    """The Python logo as a small badge on the notepad's lower corner: the writer is a Python service."""
    logo = import_svg('python.svg')
    bpy.context.view_layer.update()
    corners = [Vector(c) for c in logo.bound_box]
    centre = sum(corners, Vector()) / 8
    scale = .2 / max(max(c.x for c in corners) - min(c.x for c in corners), max(c.y for c in corners) - min(c.y for c in corners))
    logo.data.extrude = .03 / scale / 2
    holder = group('python', Vector((0, 0, 0)))
    parent(holder, owner)
    logo.parent, logo.location = holder, -centre
    holder.scale, holder.rotation_euler, holder.location = (scale,) * 3, (math.radians(90), 0, 0), (.15, -.17, .25)
    # The logo is one shape of two snakes: split them, the upper one blue and the lower one yellow.
    for obj in bpy.data.objects:
        obj.select_set(obj is logo)
    bpy.context.view_layer.objects.active = logo
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    snakes = [obj for obj in bpy.context.selected_objects]
    middle = sum((sum((Vector(c) for c in snake.bound_box), Vector()) / 8 for snake in snakes), Vector()) / len(snakes)
    for snake in snakes:
        snake.data.materials.clear()
        upper = (sum((Vector(c) for c in snake.bound_box), Vector()) / 8).y > middle.y
        snake.data.materials.append(mats['python blue' if upper else 'python yellow'])
        tag(snake, 'live:python-blue' if upper else 'live:python-yellow')


def glass_box(part, at, icon, color, level, downwards=False):
    # A clear glass cube on the platform with the part's icon floating inside, turned towards the camera.
    # The icon's outline stays ink; its inside fills with colour as the message arrives.
    pid = part['id']
    root = group(f'{pid} glass box', at + Vector((0, 0, TOP)), math.radians(45))
    case = tag(parent(box('glass box', (.92, .92, .92), (0, 0, 0), 'glass box', .14, 8), root), f'live:glass-box:{pid}')
    case.location = (0, 0, .465)
    # A hollow case with thin walls: the icon floats in air behind a thin pane instead of being bent by a solid block.
    shell = case.modifiers.new('Shell', 'SOLIDIFY')
    shell.thickness, shell.offset = .028, -1
    holder = group(f'{pid} icon', Vector((0, 0, 0)))
    parent(holder, root)
    line, inside = import_svg(f'{icon}-line.svg'), import_svg(f'{icon}-inside.svg')
    # Both share the SVG's coordinates, so one centre and scale from the outline keeps them aligned.
    bpy.context.view_layer.update()
    corners = [Vector(c) for c in line.bound_box]
    centre = sum(corners, Vector()) / 8
    bottom, top = min(c.y for c in corners), max(c.y for c in corners)
    scale = .54 / max(max(c.x for c in corners) - min(c.x for c in corners), max(c.y for c in corners) - min(c.y for c in corners))
    for obj, depth, mat, role in ((line, .07, mats['ink'], f'live:icon-line:{pid}'), (inside, .04, fill_material(f'{pid} fill', color, level, bottom, top, downwards), f'live:icon-fill:{pid}')):
        obj.parent = holder
        obj.location = -centre
        obj.data.extrude = depth / scale / 2
        obj.data.materials.append(mat)
        tag(obj, role)
    holder.scale = (scale, scale, scale)
    holder.rotation_euler = (math.radians(90), 0, 0)
    # Low and near the front pane: from above, the case's front shows the icon up to about two thirds of its height.
    holder.location = (0, -.1, .42)
    if pid == 'writer':
        python_badge(root)
    if pid == 'scd41':
        # A small CO2 inside the cloud, the 2 set lower and smaller as a subscript.
        for body, size, x, z in (('CO', .15, -.03, .385), ('2', .095, .09, .355)):
            mark = tag(text(body, size, 'medium', 'ink', 'CENTER', 'CENTER'), 'live:co2')
            parent(mark, root)
            mark.rotation_euler = (math.radians(90), 0, 0)
            mark.location = (x, -.13, z)
    return root


def valve(part, at):
    root = group('junction valve', at)
    tag(parent(box('valve body', (.62, .62, .44), (0, 0, 0), 'metal', .1), root), 'baked').location = (0, 0, .22)
    tag(parent(cylinder('hub', .08, .12, (0, 0, 0), 'dark metal'), root), 'wheel').location = (0, 0, .5)
    for angle in (45, -45):
        spoke = tag(parent(box('spoke', (.5, .07, .06), (0, 0, 0), 'dark metal', .025, 4), root), 'wheel')
        spoke.location = (0, 0, .54)
        spoke.rotation_euler = (0, 0, math.radians(angle))
    return root


def arch(width, height, leg, beam, outer_radius, inner_radius, depth):
    """A one-piece gate: an upside-down U with rounded shoulders, extruded to `depth`."""
    def corner(cx, cz, r, start, end, steps=10):
        return [(cx + r * math.cos(math.radians(start + (end - start) * i / steps)), cz + r * math.sin(math.radians(start + (end - start) * i / steps))) for i in range(steps + 1)]
    w, h = width / 2, height
    iw, ih = w - leg, height - beam
    outline = [(-w, 0)] + corner(-w + outer_radius, h - outer_radius, outer_radius, 180, 90) + corner(w - outer_radius, h - outer_radius, outer_radius, 90, 0) + [(w, 0), (iw, 0)]
    outline += corner(iw - inner_radius, ih - inner_radius, inner_radius, 0, 90) + corner(-iw + inner_radius, ih - inner_radius, inner_radius, 90, 180) + [(-iw, 0)]
    mesh = bpy.data.meshes.new('gate')
    bm = bmesh.new()
    verts = [bm.verts.new((x, -depth / 2, z)) for x, z in outline]
    face = bm.faces.new(verts)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, verts=[v for v in extruded['geom'] if isinstance(v, bmesh.types.BMVert)], vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('gate', mesh)
    scene.collection.objects.link(obj)
    return finish(obj, 'metal', .045, 5)


def gate(part, at, towards):
    # The gate stands across the tube that brings messages in.
    root = group('mosquitto gate', at + Vector((0, 0, TOP)), math.atan2(towards.y, towards.x) + math.pi / 2)
    tag(parent(arch(1.42, 1.42, .24, .3, .26, .1, .3), root), 'baked').data.materials[0] = mats['enamel']
    # An inner lining along the whole opening: the energy glows through the gate as it passes.
    lining = tag(parent(arch(1.42 - 2 * .24 + .04, 1.42 - .3 + .02, .025, .025, .12, .1, .26), root), 'live:gate-glow')
    lining.data.materials[0] = mats['seam idle' if bake else 'glow']
    mark = tag(text('MQTT', .17, 'medium', 'cream', 'CENTER', 'CENTER'), 'baked')
    mark.data.extrude, mark.data.space_character = .008, 1.25
    parent(mark, root)
    mark.rotation_euler = (math.radians(90), 0, 0)
    mark.location = (0, -.16, 1.27)
    return root


def stack(part, at):
    root = group('timescale stack', at + Vector((0, 0, TOP)))
    for i in range(4):
        tag(parent(cylinder('disc', .5, .15, (0, 0, 0), 'tile', .045), root), 'baked').location = (0, 0, .09 + i * .19)
        if i < 3:
            seam = tag(parent(cylinder('seam', .47, .04, (0, 0, 0), 'seam idle' if bake else 'seam', 0), root), f'live:seam:{i}')
            seam.location = (0, 0, .185 + i * .19)
    return root


def screen(part, at):
    root = group('grafana screen', at + Vector((0, 0, TOP)), math.radians(45))
    tag(parent(cylinder('foot', .32, .05, (0, 0, 0), 'metal', .02), root), 'baked').location = (0, 0, .025)
    tag(parent(box('neck', (.1, .08, .42), (0, 0, 0), 'metal', .035, 4), root), 'baked').location = (0, .06, .24)
    tilt = group('tilt', Vector((0, 0, 0)))
    parent(tilt, root)
    tilt.location = (0, 0, .82)
    tilt.rotation_euler = (math.radians(-12), 0, 0)
    tag(parent(box('tablet', (1.36, .08, .9), (0, 0, 0), 'tile', .06, 6), tilt), 'baked')
    # The display is a flat panel the site draws its chart on.
    bpy.ops.mesh.primitive_plane_add(size=1)
    face = bpy.context.active_object
    face.scale = (1.2, .74, 1)
    bpy.ops.object.transform_apply(scale=True)
    tag(finish(parent(face, tilt), 'screen'), 'live:screen-face')
    face.rotation_euler = (math.radians(90), 0, 0)
    face.location = (0, -.041, 0)
    if not bake:
        curve = bpy.data.curves.new('chart', 'CURVE')
        curve.dimensions, curve.bevel_depth, curve.bevel_resolution = '3D', .014, 3
        points = [.62, .55, .6, .44, .5, .36, .41, .28, .33, .24]
        spline = curve.splines.new('POLY')
        spline.points.add(len(points) - 1)
        for i, value in enumerate(points):
            spline.points[i].co = (-.52 + i * .115, -.05, .3 - value * .9, 1)
        chart = tag(bpy.data.objects.new('chart', curve), 'preview')
        scene.collection.objects.link(chart)
        chart.data.materials.append(mats['chart'])
        parent(chart, tilt)
    return root


# Tubes ----------------------------------------------------------------------------------------------

def tube(link, start, end):
    radius = .17
    curve = bpy.data.curves.new('glass tube', 'CURVE')
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution, curve.use_fill_caps = '3D', radius, 8, False
    spline = curve.splines.new('POLY')
    spline.points.add(1)
    spline.points[0].co = (*start, 1)
    spline.points[1].co = (*end, 1)
    glass = tag(bpy.data.objects.new('glass tube', curve), f"live:tube:{link['id']}")
    scene.collection.objects.link(glass)
    glass.data.materials.append(mats['glass'])
    # The site fills the tube with goo along this line.
    glass['start'], glass['end'], glass['radius'] = site(start), site(end), radius
    if not bake:
        # In the studio preview the energy runs the whole tube, as the finished page shows it.
        curve = bpy.data.curves.new('energy', 'CURVE')
        curve.dimensions, curve.bevel_depth, curve.bevel_resolution, curve.use_fill_caps = '3D', .055, 8, True
        spline = curve.splines.new('POLY')
        spline.points.add(1)
        spline.points[0].co = (*start, 1)
        spline.points[1].co = (*end, 1)
        core = tag(bpy.data.objects.new('energy', curve), 'preview')
        scene.collection.objects.link(core)
        core.data.materials.append(mats['core'])
    # Metal collars where the tube meets each part.
    direction = (end - start).normalized()
    rotation = direction.to_track_quat('Z', 'Y').to_euler()
    for point, sign in ((start, 1), (end, -1)):
        tag(cylinder('collar', .22, .13, point + direction * sign * .06, 'metal', .03, 48, rotation), 'baked')


# Build ----------------------------------------------------------------------------------------------

parts = {part['id']: part for part in layout['parts']}
at = {pid: V(x, 0, z) for pid, (x, z) in layout['at'].items()}
# Each icon's fill: the thermometer turns red from the bulb up, the cloud fills with gas, the notepad is written top down in green.
# The bake sees them empty, as the site starts them, so no coloured glow is baked into the platforms.
moment = args[3] if len(args) > 3 and not bake else 'done'
level = {'mid': (.55, .4, .5), 'done': (1, 1, 1)}[moment] if not bake else (0, 0, 0)
icons = {
    'sht31': ('thermometer', '#e5484d', level[0], False),
    'scd41': ('cloud', '#8ea3ad', level[1], False),
    'writer': ('notepad', '#2E8565', level[2], True),
}
for pid, part in parts.items():
    here_at = at[pid]
    if part['prop'] != 'valve':
        platform(part, here_at)
    if pid in icons:
        glass_box(part, here_at, *icons[pid])
    elif part['prop'] == 'valve':
        valve(part, here_at)
    elif part['prop'] == 'gate':
        before = next(link for link in layout['links'] if link['to'] == pid)['from']
        gate(part, here_at, (here_at - at[before]).normalized())
    elif part['prop'] == 'stack':
        stack(part, here_at)
    elif part['prop'] == 'screen':
        screen(part, here_at)


def side(pid, towards):
    """Where a tube leaves a part: the side facing its neighbour, or the corner when the tube runs diagonally."""
    part, origin = parts[pid], at[pid]
    d = towards - origin
    dx, dy = abs(d.x), abs(d.y)
    if dx > .01 and dy > .01 and .5 < dx / dy < 2:
        along = Vector((d.x, d.y, 0)).normalized()
        return origin + along * (part['size'] / 2 / max(abs(along.x), abs(along.y)) - .02) + Vector((0, 0, .2))
    along = Vector((math.copysign(1, d.x), 0, 0)) if dx >= dy else Vector((0, math.copysign(1, d.y), 0))
    return origin + along * (part['size'] / 2 + .02) + Vector((0, 0, .2))


for link in layout['links']:
    tube(link, side(link['from'], at[link['to']]), side(link['to'], at[link['from']]))

# The studio floor: endless for renders; for the bake, just the area whose shadows the site shows.
low = Vector((min(p.x for p in at.values()) - 2.5, min(p.y for p in at.values()) - 2.5, 0))
high = Vector((max(p.x for p in at.values()) + 2.5, max(p.y for p in at.values()) + 2.5, 0))
bpy.ops.mesh.primitive_plane_add(size=1, location=((low + high) / 2) if bake else (0, 0, 0))
ground = bpy.context.active_object
ground.name = 'ground'
ground.scale = (high.x - low.x, high.y - low.y, 1) if bake else (80, 80, 1)
bpy.ops.object.transform_apply(scale=True)
tag(finish(ground, 'ground'), 'live:ground')

# Studio light: a soft warm room, one large key from the upper left and a gentle fill.
world = bpy.data.worlds.new('studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (*linear('#f5eee3'), 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .75
scene.world = world
centre = sum(at.values(), Vector()) / len(at)
for label, offset, size, energy, color in (('key', (-7, 1.5, 10), 7, 2200, '#fff2e0'), ('fill', (6, -8, 5), 6, 500, '#eef2f5')):
    light = bpy.data.lights.new(label, 'AREA')
    light.size, light.energy, light.color = size, energy, linear(color)
    obj = bpy.data.objects.new(label, light)
    scene.collection.objects.link(obj)
    obj.location = centre + Vector(offset)
    obj.rotation_euler = (centre - obj.location).to_track_quat('-Z', 'Y').to_euler()

# The site's camera: orthographic, 45 degrees round, looking down at the layout's elevation.
elevation, azimuth = math.radians(layout['elevation']), math.radians(45)
view = Vector((math.cos(elevation) * math.sin(azimuth), -math.cos(elevation) * math.cos(azimuth), math.sin(elevation)))
camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
scene.collection.objects.link(camera)
camera.data.type = 'ORTHO'
target = centre + Vector((0, 0, .5))
camera.location = target + view * 30
camera.rotation_euler = (-view).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
bpy.context.view_layer.update()
right, up = camera.matrix_world.to_3x3() @ Vector((1, 0, 0)), camera.matrix_world.to_3x3() @ Vector((0, 1, 0))
xs, ys = [], []
for pid, point in at.items():
    h = parts[pid]['size'] / 2
    for dx, dy, z in ((-h, -h, 0), (h, -h, 0), (-h, h, 0), (h, h, 0), (0, 0, TOP + 1.4)):
        p = point + Vector((dx, dy, z)) - target
        xs.append(p.dot(right)); ys.append(p.dot(up))
width, height = 1600, 680
scene.render.resolution_x, scene.render.resolution_y = width, height
span_x, span_y = max(xs) - min(xs) + 1.2, max(ys) - min(ys) + 1.4
camera.data.ortho_scale = max(span_x, span_y * width / height)
camera.data.shift_x = (max(xs) + min(xs)) / 2 / camera.data.ortho_scale
camera.data.shift_y = (max(ys) + min(ys)) / 2 / camera.data.ortho_scale

if not bake:
    # Titles, as on the site: the name with its detail beneath, above or below each part, facing the camera.
    heights = {'sensor': 1.3, 'writer': 1.0, 'gate': 1.5, 'stack': .8, 'screen': 1.35}
    for pid, part in parts.items():
        if not part['name']:
            continue
        h, origin, side_name = part['size'] / 2, at[pid], layout['labels'].get(pid, 'below')
        if side_name == 'above':
            anchor, align = origin + Vector((0, 0, TOP + heights.get(part['prop'], .8))) + up * .5, 'BOTTOM'
        else:
            anchor, align = origin + Vector((h, -h, 0)) - up * .2, 'TOP'
        for body, size, weight, mat, shift in ((part['name'], .2, 'medium', 'label', 0), (part['detail'], .16, 'medium', 'label detail', -.26)):
            # Brought towards the camera: the view is orthographic, so this keeps its place on screen but in front of everything.
            at_label = anchor + up * (shift + (.25 if align == 'BOTTOM' else 0)) + view * 8
            # DM Sans has no subscript digits: a subscript 2 is set smaller and lower, after the rest of the line.
            main, subscript = (body.split('₂')[0], '2') if '₂' in body else (body, '')
            label = tag(text(main, size, weight, mat, 'CENTER', 'TOP'), 'preview')
            label.rotation_euler = camera.rotation_euler
            label.location = at_label - right * (size * .22 if subscript else 0)
            label.visible_shadow = False
            if subscript:
                small = tag(text(subscript, size * .65, weight, mat, 'LEFT', 'TOP'), 'preview')
                small.rotation_euler = camera.rotation_euler
                small.location = label.location + right * size * .62 * len(main) / 2 * .9 - up * size * .3
                small.visible_shadow = False

# Render with Cycles on the GPU when there is one.
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
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
# A driver too old for this Blender's GPU kernels fails only at render time: try a tiny frame first.
if scene.cycles.device == 'GPU':
    size = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = scene.render.resolution_y = 8
    scene.cycles.samples = 1
    try:
        bpy.ops.render.render()
    except RuntimeError as error:
        print('GPU unavailable, rendering on the CPU:', str(error).splitlines()[0])
        scene.cycles.device = 'CPU'
    scene.render.resolution_x, scene.render.resolution_y = size
print('DEVICE', scene.cycles.device)
scene.cycles.samples = int(args[2]) if len(args) > 2 else 160
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'AgX'

if mode == 'preview':
    # Each render gets its own name: an image open in a viewer on the PC is locked and cannot be overwritten.
    version = args[4] if len(args) > 4 else 'v1'
    scene.render.filepath = os.path.join(here, f'{name}-{moment}-{version}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
    sys.exit(0)

# Bake ------------------------------------------------------------------------------------------------
import numpy as np


def select(objects, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


# Every object stands on its own in world space, with modifiers, curves and text turned into plain meshes.
solids = [obj for obj in scene.objects if obj.get('role') and obj.type in ('MESH', 'CURVE', 'FONT')]
select(solids)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
select(solids)
bpy.ops.object.convert(target='MESH')
for obj in scene.objects:
    if obj.type == 'EMPTY':
        bpy.data.objects.remove(obj)


def join(role, label):
    members = [obj for obj in scene.objects if obj.get('role') == role]
    select(members)
    if len(members) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = label
    return obj


baked = join('baked', 'baked')
wheel = join('wheel', 'valve-wheel') if any(obj.get('role') == 'wheel' for obj in scene.objects) else None
if wheel:
    # The wheel turns about the valve's axis.
    bpy.context.scene.cursor.location = wheel.matrix_world @ (sum((Vector(c) for c in wheel.bound_box), Vector()) / 8)
    select([wheel])
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# One light texture for everything that stays still: unwrap together, then bake the full studio light into it.
targets = [baked] + ([wheel] if wheel else [])
select(targets, baked)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
bpy.ops.uv.pack_islands(margin=.003)
bpy.ops.object.mode_set(mode='OBJECT')
atlas_size = int(args[3]) if len(args) > 3 else 2048
atlas = bpy.data.images.new('atlas', atlas_size, atlas_size, float_buffer=True)
for obj in targets:
    for slot in obj.material_slots:
        nodes = slot.material.node_tree.nodes
        node = nodes.new('ShaderNodeTexImage')
        node.image = atlas
        nodes.active = node
bake_settings = scene.render.bake
bake_settings.margin, bake_settings.margin_type = 16, 'EXTEND'
select(targets, baked)
bpy.ops.object.bake(type='COMBINED')
scene.render.image_settings.file_format, scene.render.image_settings.color_depth = 'PNG', '8'
atlas.save_render(os.path.join(here, f'{name}-atlas.png'), scene=scene)
print('BAKED', f'{name}-atlas.png')
for obj in targets:
    for slot in obj.material_slots:
        nodes = slot.material.node_tree.nodes
        nodes.remove(nodes.active)

# The floor: how much light reaches it, turned into a soft shadow the site lays over its paper.
shade = bpy.data.images.new('floor light', 1024, 1024, float_buffer=True)
nodes = ground.material_slots[0].material.node_tree.nodes
node = nodes.new('ShaderNodeTexImage')
node.image = shade
nodes.active = node
bake_settings.use_pass_direct = bake_settings.use_pass_indirect = True
bake_settings.use_pass_color = False
select([ground])
bpy.ops.object.bake(type='DIFFUSE')
light = np.array(shade.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)[..., :3].mean(axis=2)
# The same floor with nothing on it: dividing by it keeps only what the objects take away (their shadows and
# contact), not the key light's own falloff across the floor.
hidden = [obj for obj in scene.objects if obj is not ground and obj.type != 'LIGHT' and not obj.hide_render]
for obj in hidden:
    obj.hide_render = True
bpy.ops.object.bake(type='DIFFUSE')
open_floor = np.array(shade.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)[..., :3].mean(axis=2)
for obj in hidden:
    obj.hide_render = False
darkness = np.clip(1 - light / np.maximum(open_floor, 1e-4), 0, 1)
# Fade out towards the floor's edges, so it never shows a border on the page.
edge = np.minimum.reduce(np.meshgrid(np.linspace(0, 1, 1024), np.linspace(0, 1, 1024)) + np.meshgrid(np.linspace(1, 0, 1024), np.linspace(1, 0, 1024)))
darkness *= np.clip(edge / .12, 0, 1) ** 2
out = bpy.data.images.new('floor shadow', 1024, 1024)
out.colorspace_settings.name = 'Non-Color'
out.pixels.foreach_set(np.dstack([darkness, darkness, darkness, np.ones_like(darkness)]).astype(np.float32).ravel())
out.filepath_raw, out.file_format = os.path.join(here, f'{name}-ground.png'), 'PNG'
out.save()
print('BAKED', f'{name}-ground.png', 'deepest shadow', float(darkness.max()))

# Export: the baked still life, the valve wheel, the floor and every live part, named for the site.
for obj in scene.objects:
    role = obj.get('role', '')
    if role.startswith('live:'):
        obj.name = role[5:]
keep = [obj for obj in scene.objects if obj.get('role', '').startswith('live:') or obj in targets]
names = {}
for obj in keep:
    # Several pieces can share a role (the CO2 marks, the two halves of a snake): number them.
    base_name = obj.name.split('.')[0]
    names[base_name] = names.get(base_name, 0) + 1
    if names[base_name] > 1:
        obj.name = f'{base_name}:{names[base_name]}'
select(keep)
bpy.ops.export_scene.gltf(filepath=os.path.join(here, f'{name}.glb'), export_format='GLB', use_selection=True, export_apply=True,
                          export_extras=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials='NONE',
                          export_cameras=False, export_lights=False, export_animations=False)
print('EXPORTED', f'{name}.glb', len(keep), 'objects')
