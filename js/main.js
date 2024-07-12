import {gl}                     from './webGL/webGL2.js';
import * as webGL2              from './webGL/webGL2.js';
import * as Programs            from './shaders.js';
import {Camera}                 from './camera.js';

import {DistanceFieldWebGL}         from './DistanceFieldWebGL.js';

let canvas = document.querySelector("#canvas3D");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
canvas.style.width = String(canvas.width) + "px";
canvas.style.height = String(canvas.height) + "px";
webGL2.setContext(canvas);

let camera = new Camera(canvas);
let cameraDistance = 20;

window.addEventListener("resize", () => {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    canvas.style.width = String(canvas.width) + "px";
    canvas.style.height = String(canvas.height) + "px";
})

window.addEventListener("wheel", event => {
    cameraDistance += event.deltaY * 0.01;
    cameraDistance = Math.min(30, Math.max(cameraDistance, 10));
});

let nissan = await webGL2.loadGeometry("./js/geometry/carscene_nissan.json");
let nissanWheels = await webGL2.loadGeometry("./js/geometry/carscene_wheels.json");
let porsche = await webGL2.loadGeometry("./js/geometry/carscene_porsche.json");
let ground = await webGL2.loadGeometry("./js/geometry/carscene_ground.json");
let room = await webGL2.loadGeometry("./js/geometry/carscene_room.json");
// let ceiling = await webGL2.loadGeometry("./js/geometry/carscene_ceiling.json");

let identityMatrix = mat4.create();

let nissanModelMatrix = mat4.fromValues(1, 0, 0, 0,
                                        0, 1, 0, 0,
                                        0, 0, 1, 0,
                                        3, 0., 0, 1); 

let porscheModelMatrix = mat4.fromValues(1, 0, 0, 0,
                                        0, 1, 0, 0,
                                        0, 0, 1, 0,
                                        -1, 0., -1.5, 1); 
                                                    


let nissanModelViewMatrix = mat4.create();
let porscheModelViewMatrix = mat4.create();

//Initiate the shaders programs
Programs.init();

//Create the voxelizers
let voxelizer = new DistanceFieldWebGL(256, 2);
let voxelsReady = false;

let sceneResolution = 700;
let sceneDistanceField = webGL2.createTexture3D(sceneResolution, sceneResolution, sceneResolution, gl.R32F, gl.RED, gl.LINEAR, gl.LINEAR, gl.FLOAT, null);


Promise.all([voxelizer.voxelize("nissan", nissan), 
             voxelizer.voxelize("porsche", porsche),
             voxelizer.voxelize("nissanWheels", nissanWheels),
             voxelizer.voxelize("room", room),
             voxelizer.voxelize("ground", ground),
            ]).then(response => {

        nissan._voxelData = response.filter(e => e.id === "nissan")[0];
        porsche._voxelData = response.filter(e => e.id === "porsche")[0];
        nissanWheels._voxelData = response.filter(e => e.id === "nissanWheels")[0];
        room._voxelData = response.filter(e => e.id === "room")[0];
        ground._voxelData = response.filter(e => e.id === "ground")[0];


        //Create the scene distance field
        gl.viewport(0, 0, sceneResolution, sceneResolution);
        gl.useProgram(Programs.sceneDFShader);
        gl.uniform1f(Programs.sceneDFShader.voxelResolution, sceneResolution);
        gl.uniform4f(Programs.sceneDFShader.uData0, -7, -1, -7, 14);

        webGL2.bindTexture(Programs.sceneDFShader.tDistance1, room._voxelData.distanceFieldTexture, 0, true);
        gl.uniformMatrix4fv(Programs.sceneDFShader.uMatrix1, false, identityMatrix);
        gl.uniform4f(Programs.sceneDFShader.uData1, room.min.x, room.min.y, room.min.z, room.scale);

        webGL2.bindTexture(Programs.sceneDFShader.tDistance2, porsche._voxelData.distanceFieldTexture, 1, true);
        gl.uniformMatrix4fv(Programs.sceneDFShader.uMatrix2, false, porscheModelMatrix);
        gl.uniform4f(Programs.sceneDFShader.uData2, porsche.min.x, porsche.min.y, porsche.min.z, porsche.scale);

        webGL2.bindTexture(Programs.sceneDFShader.tDistance3, nissan._voxelData.distanceFieldTexture, 2, true);
        gl.uniformMatrix4fv(Programs.sceneDFShader.uMatrix3, false, nissanModelMatrix);
        gl.uniform4f(Programs.sceneDFShader.uData3, nissan.min.x, nissan.min.y, nissan.min.z, nissan.scale);

        webGL2.bindTexture(Programs.sceneDFShader.tDistance4, nissanWheels._voxelData.distanceFieldTexture, 3, true);
        gl.uniformMatrix4fv(Programs.sceneDFShader.uMatrix4, false, nissanModelMatrix);
        gl.uniform4f(Programs.sceneDFShader.uData4, nissanWheels.min.x, nissanWheels.min.y, nissanWheels.min.z, nissanWheels.scale);


        let depth = sceneResolution / 4;
        for(let i = 0; i < depth; i ++) {
            let framebuffer3D = webGL2.createFramebuffer3D(sceneDistanceField, [4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3]);
            gl.uniform4f(Programs.sceneDFShader.indices, 4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer3D);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

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

    gl.drawArrays(gl.TRIANGLES, 0, geometry.length);
}


let currentFrame = 0;

let render = () => {

    currentFrame ++;

    requestAnimationFrame(render);
    camera.updateCamera(35, canvas.width / canvas.height, cameraDistance);

    mat4.multiply(nissanModelViewMatrix, camera.cameraTransformMatrix, nissanModelMatrix);
    mat4.multiply(porscheModelViewMatrix, camera.cameraTransformMatrix, porscheModelMatrix);

    gl.useProgram(Programs.renderGeometry);
    gl.uniformMatrix4fv(Programs.renderGeometry.perspectiveMatrix, false, camera.perspectiveMatrix);
    gl.uniform4f(Programs.renderGeometry.sceneData, -7, -1, -7, 14);
    gl.uniform1f(Programs.renderGeometry.uAlpha, 1);
    gl.uniform1f(Programs.renderGeometry.useReflection, 0);
    gl.uniform1f(Programs.renderGeometry.time, currentFrame * 0.01);


    webGL2.bindTexture(Programs.renderGeometry.tScene, sceneDistanceField, 0, true);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    renderGeometry(nissanModelViewMatrix, nissanModelMatrix, nissan);
    renderGeometry(nissanModelViewMatrix, nissanModelMatrix, nissanWheels);
    renderGeometry(porscheModelViewMatrix, porscheModelMatrix, porsche);
    renderGeometry(camera.cameraTransformMatrix, identityMatrix, room);
    renderGeometry(camera.cameraTransformMatrix, identityMatrix, ground);
    // renderGeometry(camera.cameraTransformMatrix, ceiling);

    // if(voxelsReady) {

    //     gl.useProgram(Programs.raymarcher);
    //     gl.viewport(0, 0, canvas.width, canvas.height);
    //     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //     webGL2.bindTexture(Programs.raymarcher.tData, sceneDistanceField, 0, true);
    //     gl.uniformMatrix4fv(Programs.raymarcher.cameraOrientation, false, camera.orientationMatrix);
    //     gl.uniform2f(Programs.raymarcher.resolution, canvas.width, canvas.height);
    //     gl.uniform3f(Programs.raymarcher.cameraPosition, camera.position[0], camera.position[1], camera.position[2]);
    //     gl.disable(gl.DEPTH_TEST);
    //     gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    //     gl.disable(gl.BLEND);
    // }

    gl.disable(gl.DEPTH_TEST);
}

render();