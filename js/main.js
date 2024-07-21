import {gl}                     from './webGL/webGL2.js';
import * as webGL2              from './webGL/webGL2.js';
import * as Programs            from './shaders.js';
import {Camera}                 from './camera.js';

import {DistanceFieldWebGL}         from './DistanceFieldWebGL.js';

import {GLTFLoader}               from './GLTFLoader.js';

let canvas = document.querySelector("#canvas3D");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
canvas.style.width = String(canvas.width) + "px";
canvas.style.height = String(canvas.height) + "px";
webGL2.setContext(canvas);

let camera = new Camera(canvas);
let cameraDistance = 9;

let displayDebug = true;

let DPR = 2;


//Textures for postprocessing
let colorTexture, depthTexture,  helpTexture;
let geomFramebuffer, postFramebuffer1, postFramebuffer2;

window.addEventListener("resize", resize)

function resize() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    canvas.style.width = String(canvas.width) + "px";
    canvas.style.height = String(canvas.height) + "px";

    gl.deleteTexture(colorTexture);
    gl.deleteTexture(depthTexture);
    gl.deleteTexture(helpTexture);

    gl.deleteFramebuffer(geomFramebuffer);
    gl.deleteFramebuffer(postFramebuffer1);
    gl.deleteFramebuffer(postFramebuffer2);

    colorTexture = webGL2.createTexture2D(DPR * canvas.width, DPR * canvas.height, gl.RGBA32F, gl.RGBA, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR, gl.FLOAT, null);
    depthTexture = webGL2.createTexture2D(DPR * canvas.width, DPR * canvas.height, gl.RGBA32F, gl.RGBA, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR, gl.FLOAT, null);
    helpTexture = webGL2.createTexture2D(DPR * canvas.width, DPR * canvas.height, gl.RGBA32F, gl.RGBA, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR, gl.FLOAT, null);

    geomFramebuffer = webGL2.createDrawFramebuffer([colorTexture, depthTexture], true);
    postFramebuffer1 = webGL2.createDrawFramebuffer(helpTexture);
    postFramebuffer2 = webGL2.createDrawFramebuffer(colorTexture);
}

resize();

window.addEventListener("keypress", e => {
    if(e.keyCode === 100) displayDebug = !displayDebug;
})

window.addEventListener("wheel", event => {
    cameraDistance += event.deltaY * 0.01;
    cameraDistance = Math.min(300, Math.max(cameraDistance, 10));
});


let loader = new GLTFLoader();
let protein = null;
let waitForGeometry = Promise.create();
let identityMatrix = mat4.create();

await loader.parse("./js/geometry/testProtein.glb").then(result => {

    protein = result[0][0];

    console.log(protein);

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;

    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    let orderedData = [];
    let orderedData2 = [];
    let data = protein.geometry.position.array;
    let data2 = protein.geometry.color.array;

    let index = protein.geometry.index;
    let total = protein.geometry.index.length;
    let sum = 1;

    for(let i = 0; i < total; i += sum) {
        let j = index[i];

        let _x = data[3 * j + 0];
        let _y = data[3 * j + 1];
        let _z = data[3 * j + 2];

        let _r = data2[4 * j + 0];
        let _g = data2[4 * j + 1];
        let _b = data2[4 * j + 2];

        minX = Math.min(minX, _x);
        minY = Math.min(minY, _y);
        minZ = Math.min(minZ, _z);

        maxX = Math.max(maxX, _x);
        maxY = Math.max(maxY, _y);
        maxZ = Math.max(maxZ, _z);

        orderedData.push(_x);
        orderedData.push(_y);
        orderedData.push(_z);

        orderedData2.push(_r);
        orderedData2.push(_g);
        orderedData2.push(_b);
    }

    protein.geometry.position = webGL2.createBuffer(protein.geometry.position.array);
    protein.geometry.normal = webGL2.createBuffer(protein.geometry.normal.array);
    protein.geometry.color = webGL2.createBuffer(protein.geometry.color.array);
    protein.geometry.totalIndices = index.length;
    protein.geometry.index = webGL2.createIndicesBuffer(protein.geometry.index);
    protein.geometry.positionArray = new Float32Array(orderedData);
    protein.geometry.colorArray = new Float32Array(orderedData2);
    protein.geometry.min = {x: minX, y: minY, z: minZ};
    protein.geometry.max = {x: maxX, y: maxY, z: maxZ};
    protein.geometry.scale = Math.max(maxX - minX, Math.max(maxY - minY, maxZ - minZ));

    waitForGeometry.resolve();
});

await waitForGeometry;


//Initiate the shaders programs
Programs.init();

async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
}


async function textureFromImage(url) {
    const source = await loadImageBitmap(url);
    return webGL2.createTexture2D(source.width, source.height, gl.RGBA8, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.UNSIGNED_BYTE, source);
}

let matcapTexture = await textureFromImage('./js/images/whiteMatcap.jpg');


//Create the voxelizers
let distanceFieldGenerator = new DistanceFieldWebGL(256, 2);
let voxelsReady = false;

Promise.all([distanceFieldGenerator.generate("protein", protein.geometry)
            ]).then(response => {

        protein.geometry._voxelData = response.filter(e => e.id === "protein")[0];
        console.log(protein.geometry);
        voxelsReady = true;
})


let renderGeometry = (modelViewMatrix, modelMatrix, geometry) => {

    gl.uniformMatrix4fv(Programs.renderGeometry.modelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix4fv(Programs.renderGeometry.modelMatrix, false, modelMatrix);

    gl.enableVertexAttribArray(Programs.renderGeometry.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.position);
    gl.vertexAttribPointer(Programs.renderGeometry.position, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(Programs.renderGeometry.normal);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normal);
    gl.vertexAttribPointer(Programs.renderGeometry.normal, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(Programs.renderGeometry.color);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry.color);
    gl.vertexAttribPointer(Programs.renderGeometry.color, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.index);

    gl.drawElements(gl.TRIANGLES, geometry.totalIndices, gl.UNSIGNED_INT, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    gl.disableVertexAttribArray(Programs.renderGeometry.position);
    gl.disableVertexAttribArray(Programs.renderGeometry.normal);
    gl.disableVertexAttribArray(Programs.renderGeometry.color);


}


let currentFrame = 0;

let render = () => {

    currentFrame ++;

    requestAnimationFrame(render);
    camera.updateCamera(35, canvas.width / canvas.height, cameraDistance);

    gl.useProgram(Programs.renderGeometry);
    gl.uniformMatrix4fv(Programs.renderGeometry.perspectiveMatrix, false, camera.perspectiveMatrix);
    gl.uniformMatrix4fv(Programs.renderGeometry.cameraOrientation, false, camera.orientationMatrix);


    gl.uniform4f(Programs.renderGeometry.sceneData, -23.199684143066406, -21.650390625, -25.683975219726562, 54.35630416870117);

    gl.uniform3f(Programs.renderGeometry.cameraPosition, camera.position[0],camera.position[1], camera.position[2]);

    gl.uniform1f(Programs.renderGeometry.uReady, Number(voxelsReady));
    gl.uniform1f(Programs.renderGeometry.uAlpha, 1);
    gl.uniform1f(Programs.renderGeometry.useReflection, 0);
    gl.uniform1f(Programs.renderGeometry.time, currentFrame * 0.01);

    webGL2.bindTexture(Programs.renderGeometry.tScene, protein.geometry._voxelData.distanceFieldTexture, 0, true);
    webGL2.bindTexture(Programs.renderGeometry.tMatcap, matcapTexture, 1);
    webGL2.bindTexture(Programs.renderGeometry.tCone, protein.geometry._voxelData.coneTexture3D, 2, true);


    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, geomFramebuffer);
    gl.viewport(0, 0, DPR * canvas.width, DPR * canvas.height);
    gl.clearColor(0.94, 0.94, 0.94, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);   

    renderGeometry(camera.cameraTransformMatrix, identityMatrix, protein.geometry);

    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);


    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);


    //Render results in the screen
    // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, postFramebuffer1);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.clearColor(0, 0, 0, 0);
    // gl.useProgram(Programs.blur);
    // webGL2.bindTexture(Programs.blur.tData, colorTexture, 0);
    // webGL2.bindTexture(Programs.blur.tDepth, depthTexture, 1);
    // gl.uniform2f(Programs.blur.uAxis, 1 / 1024., 0);
    // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


    // gl.bindTexture(gl.TEXTURE_2D, helpTexture);
    // gl.generateMipmap(gl.TEXTURE_2D);
    // gl.bindTexture(gl.TEXTURE_2D, null);


    // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    // gl.viewport(0, 0,  canvas.width, canvas.height);

    // gl.clearColor(0, 0, 0, 0);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // webGL2.bindTexture(Programs.blur.tData, helpTexture, 0);
    // webGL2.bindTexture(Programs.blur.tDepth, depthTexture, 1);
    // gl.uniform2f(Programs.blur.uAxis, 0, 1 / 1024);
    // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);



    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.viewport(0, 0,  canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.useProgram(Programs.texture);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    webGL2.bindTexture(Programs.texture.tData, colorTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if(voxelsReady && displayDebug) {

        gl.useProgram(Programs.raymarcher);
        let ss = 1;
        gl.viewport(0, 0, canvas.width * ss, canvas.height * ss);
        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        webGL2.bindTexture(Programs.raymarcher.tData, protein.geometry._voxelData.distanceFieldTexture, 0, true);
        gl.uniformMatrix4fv(Programs.raymarcher.cameraOrientation, false, camera.orientationMatrix);
        gl.uniform2f(Programs.raymarcher.resolution, canvas.width * ss, canvas.height * ss);
        gl.uniform3f(Programs.raymarcher.cameraPosition, camera.position[0], camera.position[1], camera.position[2]);
        gl.disable(gl.DEPTH_TEST);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
    }


}

render();