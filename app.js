import {
  buildProgramFromSources,
  loadShadersFromURLS,
  setupWebGL,
} from "../../libs/utils.js";
import {
  ortho,
  lookAt,
  flatten,
  inverse,
  scale,
  mult,
  normalMatrix,
  vec4,
  vec2,
  add,
  vec3,
  perspective,
  length,
} from "../../libs/MV.js";
import {
  modelView,
  loadMatrix,
  multRotationY,
  multScale,
  pushMatrix,
  popMatrix,
  multTranslation,
  multRotationZ,
  multRotationX,
  loadIdentity,
} from "../../libs/stack.js";

import * as SPHERE from "../../libs/sphere.js";
import * as CUBE from "../../libs/cube.js";
import * as PYRAMID from "../../libs/pyramid.js";
import * as TORUS from "../../libs/torus.js";
import * as CYLINDER from "../../libs/cylinder.js";
import * as dat from "../../libs/dat.gui.module.js";

/** @type WebGLRenderingContext */

let gl;
let mode; // Drawing mode (gl.LINES or gl.TRIANGLES)
let shape = "sphere"; // primitive drawn
let lightsOn = true;  // if light are supposed to be shown
let animation = true; // Animation is running
let cameraGUI;

let mouse_down = false;
let downX;
let downY;

const FLOOR_HEIGHT = 0.5;
const MAX_LIGHTS = 8;

function setup(shaders) {
  let canvas = document.getElementById("gl-canvas");

  gl = setupWebGL(canvas);

  let program = buildProgramFromSources(
    gl,
    shaders["shader.vert"],
    shaders["shader.frag"]
  );

  let programLight = buildProgramFromSources(
      gl,
      shaders["shader.vert"],
      shaders["shaderLight.frag"]
  );


  mode = gl.TRIANGLES;

  gl.clearColor(0.0, 0.0, 0.0, 1);

  SPHERE.init(gl);
  CUBE.init(gl);
  CYLINDER.init(gl);
  TORUS.init(gl);
  PYRAMID.init(gl);

  gl.enable(gl.DEPTH_TEST); // Enables Z-buffer depth test

  cameraGUI = new dat.GUI({ name: "Camera GUI" });

  // OPTIONS
  let optionsFolder = cameraGUI.addFolder("options");

  let options = {
    wireframe: false,
    backfaceCulling: true,
    depthFirst: true,
    showLights: true,
  };

  /// wireframe
  optionsFolder
    .add(options, "wireframe")
    .listen()
    .onChange(function (v) {
      if (options.wireframe) {
        mode = gl.LINES;
      } else {
        mode = gl.TRIANGLES;
      }
    });
  // depth first
  optionsFolder
    .add(options, "depthFirst")
    .listen()
    .name("depth first")
    .onChange(function (v) {
      if (options.depthFirst) gl.disable(gl.DEPTH_TEST);
      else gl.enable(gl.DEPTH_TEST);
    });
  // backfaceculling
  optionsFolder
    .add(options, "backfaceCulling")
    .listen()
    .name("backface culling")
    .onChange(function (v) {
      if (options.depthFirst) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
      } else gl.disable(gl.CULL_FACE);
    });
  // show lights
  optionsFolder
    .add(options, "showLights")
    .listen()
    .name("show lights")
    .onChange(function (v) {
      lightsOn = !lightsOn;
    });

  // CAMERA
  let cameraFolder = cameraGUI.addFolder("camera");
  let aspectWindow = canvas.width / canvas.height;

  let camera = {
    eye: vec3(3.67, 4.06, 2.73),
    at: vec3(0, 0, 0),
    up: vec3(0, 1, 0),
    fovy: 75,
    aspect: aspectWindow,
    near: 0.1,
    far: 20,
  };

  // resize window
  resize_canvas();

  window.addEventListener("resize", resize_canvas);

  function resize_canvas(event) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    aspectWindow = canvas.width / canvas.height;
    camera.aspect = aspectWindow;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // camera options
  cameraFolder
      .add(camera, "fovy")
      .min(1).max(100).step(0.5)
      .listen();
  cameraFolder
    .add(camera, "near")
    .min(0.1)
    .max(20)
    .listen()
    .onChange(function (v) {
      camera.near = Math.min(camera.far - 0.5, v);
    });

  cameraFolder
    .add(camera, "far")
    .min(0.1)
    .max(20)
    .listen()
    .onChange(function (v) {
      camera.far = Math.max(camera.near + 0.5, v);
    });

  const eye = cameraFolder.addFolder("eye");
  eye.add(camera.eye, 0).step(0.05).name("x").listen();
  eye.add(camera.eye, 1).step(0.05).name("y").listen();
  eye.add(camera.eye, 2).step(0.05).name("z").listen();

  const at = cameraFolder.addFolder("at");
  at.add(camera.at, 0).step(0.05).name("x").listen();
  at.add(camera.at, 1).step(0.05).name("y").listen();
  at.add(camera.at, 2).step(0.05).name("z").listen();

  const up = cameraFolder.addFolder("up");
  up.add(camera.up, 0).step(0.05).name("x").listen();
  up.add(camera.up, 1).step(0.05).name("y").listen();
  up.add(camera.up, 2).step(0.05).name("z").listen();

  // LIGHTS
  let lightsFolder = cameraFolder.addFolder("lights");

  let lightArray = [];
  let obj = {
    add: function addLight() {
      if (lightArray.length < MAX_LIGHTS) {
        let lightDic = {
          pos: vec3(3, 5, 0),
          ambient: [10, 10, 10],
          diffuse: [255, 255, 255],
          specular: [255, 255, 255],
          directional: false,
          active: true,
        };

        lightArray.push(lightDic);

        let lightFolder = lightsFolder.addFolder("light" + lightArray.length);
        let lightPosFolder = lightFolder.addFolder("position");
        lightPosFolder.add(lightDic.pos, 0).step(0.05).name("x").listen();
        lightPosFolder.add(lightDic.pos, 1).step(0.05).name("y").listen();
        lightPosFolder.add(lightDic.pos, 2).step(0.05).name("z").listen();
        lightFolder.addColor(lightDic, "ambient").listen();
        lightFolder.addColor(lightDic, "diffuse").listen();
        lightFolder.addColor(lightDic, "specular").listen();
        lightFolder.add(lightDic, "directional");
        lightFolder.add(lightDic, "active");
      }
    },
  };
  // add light tab
  lightsFolder.add(obj, "add").name("Add a new light");

  // TODO REMOVE
  function addLight() {
    if (lightArray.length < MAX_LIGHTS) {
      let lightDic = {
        pos: vec3(3, 5, 0),
        ambient: [10, 10, 10],
        diffuse: [255, 255, 255],
        specular: [255, 255, 255],
        directional: false,
        active: true,
      };

      lightArray.push(lightDic);

      let lightFolder = lightsFolder.addFolder("light" + lightArray.length);
      let lightPosFolder = lightFolder.addFolder("position");
      lightPosFolder.add(lightDic.pos, 0).step(0.05).name("x").listen();
      lightPosFolder.add(lightDic.pos, 1).step(0.05).name("y").listen();
      lightPosFolder.add(lightDic.pos, 2).step(0.05).name("z").listen();
      lightFolder.addColor(lightDic, "ambient").listen();
      lightFolder.addColor(lightDic, "diffuse").listen();
      lightFolder.addColor(lightDic, "specular").listen();
      lightFolder.add(lightDic, "directional");
      lightFolder.add(lightDic, "active");
    }
  }
  // add first light
  addLight();

  // draw lights
  function drawLights() {
    if (lightsOn) {
      for (let l of lightArray) {
        pushMatrix();
        multTranslation(l.pos);
        multScale([0.1, 0.1, 0.1]);
        lightColor(l.diffuse);
        uploadModelViewLights();
        SPHERE.draw(gl, programLight, gl.LINES);
        popMatrix();
      }
    }
  }

  function lightColor(difuse) {
      let color = gl.getUniformLocation(programLight, "fColor");
      gl.uniform4fv(color, vec4(difuse[0]/255, difuse[1]/255, difuse[2]/255, 1.0));
  }

  let objectGUI = new dat.GUI({ name: "Object GUI" });

  var objectMaterial = {
    Ka: [93, 255, 0],
    Kd: [0, 255, 30],
    Ks: [255, 255, 255],
    shininess: 12,
  };

  // change object type
  let objectType = {
    type: "sphere",
  };
  objectGUI
    .add(objectType, "type", ["cube", "sphere", "cylinder", "pyramid", "torus"])
    .listen()
    .onChange(function (v) {
      shape = objectType.type;
      draw();
    });
  // change object type
  function draw() {
    switch (shape) {
      case "sphere":
        SPHERE.draw(gl, program, mode);
        break;
      case "cube":
        CUBE.draw(gl, program, mode);
        break;
      case "cylinder":
        CYLINDER.draw(gl, program, mode);
        break;
      case "pyramid":
        PYRAMID.draw(gl, program, mode);
        break;
      case "torus":
        TORUS.draw(gl, program, mode);
        break;
    }
  }

  // change colors
  let materialFolder = objectGUI.addFolder("material");
  materialFolder.addColor(objectMaterial, "Ka").listen();
  materialFolder.addColor(objectMaterial, "Kd").listen();
  materialFolder.addColor(objectMaterial, "Ks").listen();
  materialFolder.add(objectMaterial, "shininess").step(0.05).listen();

  function uploadModelView() {
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mModelView"),
      false,
      flatten(modelView())
    );
  }

  function uploadModelViewLights() {
    gl.uniformMatrix4fv(
        gl.getUniformLocation(programLight, "mModelView"),
        false,
        flatten(modelView())
    );
  }

  window.requestAnimationFrame(render);

  function render() {
    window.requestAnimationFrame(render);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);

    let mProj = perspective(
      camera.fovy,
      camera.aspect,
      camera.near,
      camera.far
    );

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mProjection"),
      false,
      flatten(mProj)
    );

    gl.uniform1f(
      gl.getUniformLocation(program, "uMaterial.shininess"),
      objectMaterial.shininess
    );

    gl.uniform3fv(
      gl.getUniformLocation(program, "uMaterial.Ka"),
      flatten(
        vec3(
          objectMaterial.Ka[0] / 255,
          objectMaterial.Ka[1] / 255,
          objectMaterial.Ka[2] / 255
        )
      )
    );

    gl.uniform3fv(
      gl.getUniformLocation(program, "uMaterial.Kd"),
      flatten(
        vec3(
          objectMaterial.Kd[0] / 255,
          objectMaterial.Kd[1] / 255,
          objectMaterial.Kd[2] / 255
        )
      )
    );

    gl.uniform3fv(
      gl.getUniformLocation(program, "uMaterial.Ks"),
      flatten(
        vec3(
          objectMaterial.Ks[0] / 255,
          objectMaterial.Ks[1] / 255,
          objectMaterial.Ks[2] / 255
        )
      )
    );

    gl.uniform1i(gl.getUniformLocation(program, "uNLights"), lightArray.length);

    let counter = 0;
    for (let l of lightArray) {
      gl.uniform3fv(
        gl.getUniformLocation(program, "uLight[" + counter + "].pos"),
        flatten(l.pos)
      );

      gl.uniform3fv(
        gl.getUniformLocation(program, "uLight[" + counter + "].Ia"),
        flatten(
          vec3(l.ambient[0] / 255, l.ambient[1] / 255, l.ambient[2] / 255)
        )
      );

      gl.uniform3fv(
        gl.getUniformLocation(program, "uLight[" + counter + "].Id"),
        flatten(
          vec3(l.diffuse[0] / 255, l.diffuse[1] / 255, l.diffuse[2] / 255)
        )
      );

      gl.uniform3fv(
        gl.getUniformLocation(program, "uLight[" + counter + "].Is"),
        flatten(
          vec3(l.specular[0] / 255, l.specular[1] / 255, l.specular[2] / 255)
        )
      );

      gl.uniform1f(
        gl.getUniformLocation(program, "uLight[" + counter + "].isDirectional"),
        l.directional
      );

      gl.uniform1f(
        gl.getUniformLocation(program, "uLight[" + counter + "].isActive"),
        l.isActive
      );

      counter++;
    }

    let tempM = modelView();
    loadIdentity();
    let mModel = modelView();
    loadMatrix(tempM);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mModel"),
      false,
      flatten(mModel)
    );

    // TODO: when mouse rotates in the x axis, check length that mouse travelled and use that to calculate angle of rotation
    let mView = lookAt(camera.eye, camera.at, camera.up);

    loadMatrix(mView);

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mView"),
      false,
      flatten(mView)
    );

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mNormals"),
      false,
      flatten(normalMatrix(modelView()))
    );

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mModelNormals"),
      false,
      flatten(normalMatrix(mModel))
    );

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "mModelViewNormals"),
      false,
      flatten(normalMatrix(modelView()))
    );

    uploadModelView();
    pushMatrix();
    multTranslation([0, 1, 0]);
    uploadModelView();
    draw();
    multTranslation([0, -(1 / 2 + FLOOR_HEIGHT / 2), 0]);
    multScale([5, FLOOR_HEIGHT, 5]);

    gl.uniform3fv(gl.getUniformLocation(program, "uMaterial.Ka"), flatten(vec3(0.2,0.6,0.2)));
    gl.uniform3fv(gl.getUniformLocation(program, "uMaterial.Kd"), flatten(vec3(0.2,0.6,0.2)));
    gl.uniform3fv(gl.getUniformLocation(program, "uMaterial.Ka"), flatten(vec3(0.2,0.6,0.2)));
    gl.uniform1f(gl.getUniformLocation(program, "uMaterial.shininess"), 50);

    uploadModelView();
    CUBE.draw(gl, program, mode);
    popMatrix();

    // for lights
    gl.useProgram(programLight);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(programLight, "mModelView"),
        false,
        flatten(mView)
    );

    gl.uniformMatrix4fv(
        gl.getUniformLocation(programLight, "mModelViewNormals"),
        false,
        flatten(normalMatrix(modelView()))
    );

    gl.uniformMatrix4fv(
        gl.getUniformLocation(programLight, "mProjection"),
        false,
        flatten(mProj)
    );

    drawLights();
  }
}
const urls = ["shader.vert", "shader.frag", "shaderLight.frag"];
loadShadersFromURLS(urls).then((shaders) => setup(shaders));
