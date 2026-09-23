/* Interactive character lab. UI clocks are separate from deterministic character time. */
(function () {
  "use strict";
  const A = globalThis.MykoCharacter,
    S = globalThis.MykoTestScene;
  const canvas = document.querySelector("#myko-canvas"),
    ctx = canvas.getContext("2d");
  const form = document.querySelector("#rig-controls"),
    status = document.querySelector("#frame-status");
  const query = new URLSearchParams(location.search);
  const state = {
    facing: "left",
    pose: "neutral",
    eyeExpression: "neutral",
    fps: 12,
    time: 0,
    debug: false,
    imperfections: false,
    playing: false,
    sheet: query.get("sheet") || "hero",
    manual: {},
  };
  const jointNames = [
    "bodyLean",
    "headRotation",
    "headTilt",
    "leftShoulder",
    "leftElbow",
    "leftWrist",
    "rightShoulder",
    "rightElbow",
    "rightWrist",
    "leftHip",
    "leftKnee",
    "leftFoot",
    "rightHip",
    "rightKnee",
    "rightFoot",
    "eyeLookX",
    "eyeLookY",
    "breathing",
    "mushroomSway",
    "myceliumGlow",
  ];
  const jointBox = document.querySelector("#joint-controls");
  function pretty(s) {
    return s
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  }
  for (const name of jointNames) {
    const label = document.createElement("label"),
      text = document.createElement("span"),
      input = document.createElement("input"),
      out = document.createElement("output");
    text.textContent = pretty(name);
    input.type = "range";
    input.name = name;
    input.dataset.joint = name;
    input.min = name === "myceliumGlow" || name === "breathing" ? "0" : "-1";
    input.max = "1";
    input.step = ".01";
    input.value = name === "myceliumGlow" ? ".7" : "0";
    out.textContent = input.value;
    input.addEventListener("input", () => {
      state.manual[name] = Number(input.value);
      out.textContent = Number(input.value).toFixed(2);
      draw();
    });
    label.append(text, input, out);
    jointBox.append(label);
  }
  function options(t = state.time) {
    return {
      ...A.getPose(state.pose, t, { fps: state.fps }),
      ...state.manual,
      facing: state.facing,
      eyeExpression: state.eyeExpression,
      time: t,
      fps: state.fps,
      stopMotion: true,
      animate: true,
      debug: state.debug,
      imperfections: state.imperfections,
    };
  }
  function draw() {
    const sheet = S.sizes[state.sheet];
    const [W, H] = sheet || [1200, 940];
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    if (sheet)
      S.draw(ctx, state.sheet, {
        debug: state.debug,
        imperfections: state.imperfections,
      });
    else S.hero(ctx, W, H, options());
    const effective = options();
    jointBox.querySelectorAll("input").forEach((input) => {
      input.value = effective[input.name] ?? A.defaults[input.name];
      input.nextElementSibling.textContent = Number(input.value).toFixed(2);
    });
    const frame = Math.floor(state.time * 24 + 1e-7),
      held = Math.floor(state.time * state.fps + 1e-7);
    status.textContent = `Film frame ${String(frame).padStart(3, "0")} / held pose ${String(held).padStart(2, "0")} · ${state.time.toFixed(2)}s`;
    document.querySelector("#time").value = state.time;
    document.body.classList.toggle("sheet-mode", !!sheet);
    document
      .querySelectorAll("[data-sheet]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.sheet === state.sheet)),
      );
  }
  form.addEventListener("change", (event) => {
    const input = event.target;
    if (
      ![
        "facing",
        "pose",
        "eyeExpression",
        "fps",
        "debug",
        "imperfections",
      ].includes(input.name)
    )
      return;
    state[input.name] =
      input.type === "checkbox"
        ? input.checked
        : input.name === "fps"
          ? Number(input.value)
          : input.value;
    if (input.name === "pose") {
      state.time = 0;
      state.manual = {};
    }
    draw();
  });
  document.querySelector("#time").addEventListener("input", (event) => {
    state.time = Number(event.target.value);
    draw();
  });
  document.querySelector("#play").addEventListener("click", () => {
    state.playing = !state.playing;
    document.querySelector("#play").textContent = state.playing
      ? "Pause"
      : "Play pose";
    document
      .querySelector("#play")
      .setAttribute("aria-pressed", String(state.playing));
  });
  document.querySelector("#step").addEventListener("click", () => {
    state.playing = false;
    document.querySelector("#play").textContent = "Play pose";
    document.querySelector("#play").setAttribute("aria-pressed", "false");
    state.time = ((Math.round(state.time * state.fps) + 1) / state.fps) % 4;
    draw();
  });
  document.querySelector("#reset-pose").addEventListener("click", () => {
    state.playing = false;
    document.querySelector("#play").textContent = "Play pose";
    document.querySelector("#play").setAttribute("aria-pressed", "false");
    state.time = 0;
    state.manual = {};
    form.reset();
    state.facing = "left";
    state.pose = "neutral";
    state.eyeExpression = "neutral";
    state.fps = 12;
    state.debug = false;
    state.imperfections = false;
    draw();
  });
  document.querySelectorAll("[data-sheet]").forEach((b) =>
    b.addEventListener("click", () => {
      state.sheet = b.dataset.sheet;
      draw();
    }),
  );
  document.querySelector("#download").addEventListener("click", () => {
    const anchor = document.createElement("a");
    anchor.download = `myko-${state.sheet === "hero" ? `${state.facing}-${state.pose}-${state.eyeExpression}` : state.sheet}.png`;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      anchor.href = url;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  });
  let previous = null;
  function tick(now) {
    if (state.playing && previous !== null) {
      const oldPose = Math.floor(state.time * state.fps);
      state.time = (state.time + Math.min((now - previous) / 1000, 0.1)) % 4;
      // The clock advances continuously; redraw only when the held drawing changes.
      if (Math.floor(state.time * state.fps) !== oldPose) draw();
    }
    previous = now;
    requestAnimationFrame(tick);
  }
  globalThis.MykoLab = {
    state,
    options,
    draw,
    set(patch) {
      Object.assign(state, patch);
      draw();
    },
  };
  draw();
  requestAnimationFrame(tick);
})();
