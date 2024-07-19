import {gl}                     from './webGL/webGL2.js';
import * as webGL2              from './webGL/webGL2.js';
import {vsRenderGeometry}       from './shaders/general/vs-renderGeometry.js'
import {fsColor}                from './shaders/general/fs-simpleColor.js';
import {vsVoxelizer}            from './shaders/voxelizer/vs-voxelizer.js';
import {vsVoxelizerColor}            from './shaders/voxelizer/vs-voxelizerColor.js';

import {vsQuad}                 from './shaders/general/vs-quad.js';
import {fsTexture}              from './shaders/general/fs-simpleTexture.js';
import {fsFilter}               from './shaders/voxelizer/fs-filter.js';
import {fsJumpFlood}            from './shaders/voxelizer/fs-jumpFlood.js';
import { fsJumpFloodDistance }  from './shaders/voxelizer/fs-jumpFloodDistance.js';
import { fsArrayTo3D }          from './shaders/voxelizer/fs-array2Dto3D.js';
import { fsRaymarching }        from './shaders/general/fs-raymarching.js';
import { fsSceneDF }            from './shaders/voxelizer/fs-sceneDF.js';
import { fsRenderGeometry }     from './shaders/general/fs-renderGeometry.js';
import { fsBlur }               from './shaders/general/fs-blur.js';



//=======================================================================================================
// Shader programs
//=======================================================================================================


export let renderGeometry;
export let voxelizer;
export let voxelizerColor;
export let texture;
export let filterVoxels;
export let jumpFlood;
export let jumpFloodDistance;
export let arrayTo3D;
export let raymarcher;
export let sceneDFShader;
export let blur;


//=======================================================================================================
// Shader programs initiation
//=======================================================================================================

export function init() {

    renderGeometry = webGL2.generateProgram(vsRenderGeometry, fsRenderGeometry);
    renderGeometry.position = gl.getAttribLocation(renderGeometry, "position");
    renderGeometry.normal = gl.getAttribLocation(renderGeometry, "normal");
    renderGeometry.color = gl.getAttribLocation(renderGeometry, "color");

    renderGeometry.modelMatrix = gl.getUniformLocation(renderGeometry, "modelMatrix");
    renderGeometry.modelViewMatrix = gl.getUniformLocation(renderGeometry, "modelViewMatrix");
    renderGeometry.perspectiveMatrix = gl.getUniformLocation(renderGeometry, "perspectiveMatrix");
    renderGeometry.cameraOrientation = gl.getUniformLocation(renderGeometry, "cameraOrientation");

    renderGeometry.tScene = gl.getUniformLocation(renderGeometry, "tScene");
    renderGeometry.sceneData = gl.getUniformLocation(renderGeometry, "sceneData");
    renderGeometry.uAlpha = gl.getUniformLocation(renderGeometry, "uAlpha");
    renderGeometry.time = gl.getUniformLocation(renderGeometry, "time");
    renderGeometry.cameraPosition = gl.getUniformLocation(renderGeometry, "cameraPosition");
    renderGeometry.useReflection = gl.getUniformLocation(renderGeometry, "useReflection");
    renderGeometry.uReady = gl.getUniformLocation(renderGeometry, "uReady");
    renderGeometry.tMatcap = gl.getUniformLocation(renderGeometry, "tMatcap");
    renderGeometry.tCone = gl.getUniformLocation(renderGeometry, "tCone");



    
    voxelizer = webGL2.generateProgram(vsVoxelizer, fsColor);
    voxelizer.tPositions = gl.getUniformLocation(voxelizer, "tPositions");
    voxelizer.uSize = gl.getUniformLocation(voxelizer, "uSize");
    voxelizer.uMin = gl.getUniformLocation(voxelizer, "uMin");
    voxelizer.uScaleVoxel = gl.getUniformLocation(voxelizer, "uScaleVoxel");
    voxelizer.uDataTextureSize = gl.getUniformLocation(voxelizer, "uDataTextureSize");
    voxelizer.uBucketData = gl.getUniformLocation(voxelizer, "uBucketData");
    voxelizer.uPoints = gl.getUniformLocation(voxelizer, "uPoints");
    voxelizer.uRings = gl.getUniformLocation(voxelizer, "uRings");


    voxelizerColor = webGL2.generateProgram(vsVoxelizerColor, fsColor);
    voxelizerColor.tPositions = gl.getUniformLocation(voxelizerColor, "tPositions");
    voxelizerColor.tColor = gl.getUniformLocation(voxelizerColor, "tColor");
    voxelizerColor.uSize = gl.getUniformLocation(voxelizerColor, "uSize");
    voxelizerColor.uMin = gl.getUniformLocation(voxelizerColor, "uMin");
    voxelizerColor.uScaleVoxel = gl.getUniformLocation(voxelizerColor, "uScaleVoxel");
    voxelizerColor.uDataTextureSize = gl.getUniformLocation(voxelizerColor, "uDataTextureSize");
    voxelizerColor.uBucketData = gl.getUniformLocation(voxelizerColor, "uBucketData");
    voxelizerColor.uPoints = gl.getUniformLocation(voxelizerColor, "uPoints");
    voxelizerColor.uRings = gl.getUniformLocation(voxelizerColor, "uRings");


    texture = webGL2.generateProgram(vsQuad, fsTexture);
    texture.uTexture = gl.getUniformLocation(texture, "uTexture");


    filterVoxels = webGL2.generateProgram(vsQuad, fsFilter);
    filterVoxels.tData = gl.getUniformLocation(filterVoxels, "tData");


    jumpFlood = webGL2.generateProgram(vsQuad, fsJumpFlood);
    jumpFlood.tJump = gl.getUniformLocation(jumpFlood, "tJump");
    jumpFlood.voxelResolution = gl.getUniformLocation(jumpFlood, "voxelResolution");
    jumpFlood.uOffset = gl.getUniformLocation(jumpFlood, "uOffset");
    jumpFlood.uTextSize = gl.getUniformLocation(jumpFlood, "uTextSize");
    jumpFlood.uBucketData = gl.getUniformLocation(jumpFlood, "uBucketData");


    jumpFloodDistance = webGL2.generateProgram(vsQuad, fsJumpFloodDistance);
    jumpFloodDistance.tJump = gl.getUniformLocation(jumpFloodDistance, "tJump");
    jumpFloodDistance.voxelResolution = gl.getUniformLocation(jumpFloodDistance, "voxelResolution");
    jumpFloodDistance.uTextSize = gl.getUniformLocation(jumpFloodDistance, "uTextSize");
    jumpFloodDistance.uBucketData = gl.getUniformLocation(jumpFloodDistance, "uBucketData");

    
    arrayTo3D = webGL2.generateProgram(vsQuad, fsArrayTo3D);
    arrayTo3D.tData = gl.getUniformLocation(arrayTo3D, "tData");
    arrayTo3D.voxelData = gl.getUniformLocation(arrayTo3D, "voxelData");
    arrayTo3D.indices = gl.getUniformLocation(arrayTo3D, "indices");


    raymarcher = webGL2.generateProgram(vsQuad, fsRaymarching);
    raymarcher.tData = gl.getUniformLocation(raymarcher, "tData");
    raymarcher.cameraPosition = gl.getUniformLocation(raymarcher, "cameraPosition");
    raymarcher.cameraOrientation = gl.getUniformLocation(raymarcher, "cameraOrientation");
    raymarcher.resolution = gl.getUniformLocation(raymarcher, "resolution");


    sceneDFShader = webGL2.generateProgram(vsQuad, fsSceneDF);
    sceneDFShader.voxelResolution = gl.getUniformLocation(sceneDFShader, "voxelResolution");
    sceneDFShader.uData0 = gl.getUniformLocation(sceneDFShader, "uData0");
    sceneDFShader.indices = gl.getUniformLocation(sceneDFShader, "indices");

    sceneDFShader.tDistance1 = gl.getUniformLocation(sceneDFShader, "tDistance1");
    sceneDFShader.uData1 = gl.getUniformLocation(sceneDFShader, "uData1");
    sceneDFShader.uMatrix1 = gl.getUniformLocation(sceneDFShader, "uMatrix1");

    sceneDFShader.tDistance2 = gl.getUniformLocation(sceneDFShader, "tDistance2");
    sceneDFShader.uData2 = gl.getUniformLocation(sceneDFShader, "uData2");
    sceneDFShader.uMatrix2 = gl.getUniformLocation(sceneDFShader, "uMatrix2");

    sceneDFShader.tDistance3 = gl.getUniformLocation(sceneDFShader, "tDistance3");
    sceneDFShader.uData3 = gl.getUniformLocation(sceneDFShader, "uData3");
    sceneDFShader.uMatrix3 = gl.getUniformLocation(sceneDFShader, "uMatrix3");

    sceneDFShader.tDistance4 = gl.getUniformLocation(sceneDFShader, "tDistance4");
    sceneDFShader.uData4 = gl.getUniformLocation(sceneDFShader, "uData4");
    sceneDFShader.uMatrix4 = gl.getUniformLocation(sceneDFShader, "uMatrix4");

    sceneDFShader.tDistance5 = gl.getUniformLocation(sceneDFShader, "tDistance5");
    sceneDFShader.uData5 = gl.getUniformLocation(sceneDFShader, "uData5");
    sceneDFShader.uMatrix5 = gl.getUniformLocation(sceneDFShader, "uMatrix5");


    blur = webGL2.generateProgram(vsQuad, fsBlur);
    blur.tData = gl.getUniformLocation(blur, "tData");
    blur.tDepth = gl.getUniformLocation(blur, "tDepth");
    blur.uAxis = gl.getUniformLocation(blur, "uAxis");


}