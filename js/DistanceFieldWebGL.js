import {gl} from './webGL/webGL2.js';
import * as webGL2              from './webGL/webGL2.js';
import * as Programs            from './shaders.js';

class DistanceFieldWebGL {

    constructor(voxelResolution = 256, ringsToVisit = 2) {

        this.POWER_OF_TWO_RESOLUTIONS = [32, 64, 128, 256];
        this.LAYER_SIZES = [8, 8, 16, 16];
        this.TEXTURE_SIZES = [512, 512, 2048, 4096];
        this.isPowerOfTwo = this.POWER_OF_TWO_RESOLUTIONS.indexOf( voxelResolution );
        this.voxelResolution = voxelResolution;
        this.layerSize = -1;
        this.ringsToVisit = ringsToVisit;
    
        this.totalMemoryUsed = 0;

        this.setupGlobalScene();

        this.actionHandlerMap = {};
    }

    setupGlobalScene() {

        this.voxelsTextureSize = this.isPowerOfTwo > -1 ? this.TEXTURE_SIZES[this.isPowerOfTwo] : Math.ceil(Math.sqrt(Math.pow(this.voxelResolution, 3)));
        if (this.isPowerOfTwo > -1) this.layerSize = this.LAYER_SIZES[this.isPowerOfTwo];

        this.totalMemoryUsed += Math.pow(this.voxelsTextureSize, 2) * 16;
        let voxelizer = 1;
        this.kernel = voxelizer;

    }

    prepareAndGetMeshData(geom, id) {

        let positions = new Float32Array(geom.positionArray);
        let colors = new Float32Array(geom.colorArray);
        let scale = geom.scale;

        let worker = new Worker("./js/triangleSplitter.js");

        let workerResult = new Promise((resolve, reject) => {

            worker.postMessage([id, positions, colors, scale]);

            this.actionHandlerMap[id] = response => {

                let positionsTexture = webGL2.createTexture2D(response.textureSize, response.textureSize, gl.RGB32F, gl.RGB, gl.NEAREST, gl.NEAREST, gl.FLOAT, response.positionsData);
                
                let colorsTexture = webGL2.createTexture2D(response.textureSize, response.textureSize, gl.RGB32F, gl.RGB, gl.NEAREST, gl.NEAREST, gl.FLOAT, response.colorsData);


                let voxelsTexture = webGL2.createTexture2D(this.voxelsTextureSize, this.voxelsTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, null);
                let distanceColors = webGL2.createTexture2D(this.voxelsTextureSize, this.voxelsTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, null);

                let voxelsTexture2 = webGL2.createTexture2D(this.voxelsTextureSize, this.voxelsTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, null);
                let voxelConeTracing = webGL2.createTexture2D(this.voxelsTextureSize, this.voxelsTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, null);

                let voxels = webGL2.createDrawFramebuffer(voxelsTexture);
                let voxels2 = webGL2.createDrawFramebuffer(voxelsTexture2);
                let coneTracing = webGL2.createDrawFramebuffer(voxelConeTracing);

                let voxelizerFramebuffer = webGL2.createDrawFramebuffer([voxelsTexture2, distanceColors], true);

                gl.viewport(0, 0, this.voxelsTextureSize, this.voxelsTextureSize);

                //Calculate the voxelization
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, voxelizerFramebuffer);
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LESS);

                gl.useProgram(Programs.quadColor);
                gl.uniform3f(Programs.quadColor.color, 0, 0, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                gl.useProgram(Programs.voxelizer);

                webGL2.bindTexture(Programs.voxelizer.tPositions, positionsTexture, 0);
                webGL2.bindTexture(Programs.voxelizer.tColors, colorsTexture, 1);

                gl.uniform3f(Programs.voxelizer.uSize, this.voxelResolution, this.voxelResolution, this.voxelResolution);
                gl.uniform3f(Programs.voxelizer.uMin, geom.min.x, geom.min.y, geom.min.z);
                gl.uniform1f(Programs.voxelizer.uRings, this.ringsToVisit);
                gl.uniform1f(Programs.voxelizer.uScaleVoxel, geom.scale);
                gl.uniform1f(Programs.voxelizer.uDataTextureSize, response.textureSize);
                gl.uniform3f(Programs.voxelizer.uBucketData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);
                gl.uniform1f(Programs.voxelizer.uPoints, 0);

                gl.drawArraysInstanced(gl.POINTS, 0, response.amountOfTriangles, Math.pow(2 * this.ringsToVisit + 1, 3));
                gl.disable(gl.DEPTH_TEST);



                // gl.disable(gl.BLEND);

                // this.ringsToVisit = 2;
                // gl.useProgram(Programs.voxelizerColor);
                // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, coneTracing);
                // gl.disable(gl.DEPTH_TEST);

                // const cc = .0;
                // gl.enable(gl.BLEND);
                // gl.blendEquation(gl.FUNC_ADD);
                // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                // gl.clearColor(cc, cc, cc, 1.);
                // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


                // webGL2.bindTexture(Programs.voxelizerColor.tPositions, positionsTexture, 0);
                // webGL2.bindTexture(Programs.voxelizerColor.tColor, colorsTexture, 1);

                // gl.uniform3f(Programs.voxelizerColor.uSize, this.voxelResolution, this.voxelResolution, this.voxelResolution);
                // gl.uniform3f(Programs.voxelizerColor.uMin, geom.min.x, geom.min.y, geom.min.z);
                // gl.uniform1f(Programs.voxelizerColor.uRings, this.ringsToVisit);
                // gl.uniform1f(Programs.voxelizerColor.uScaleVoxel, geom.scale);
                // gl.uniform1f(Programs.voxelizerColor.uDataTextureSize, response.textureSize);
                // gl.uniform3f(Programs.voxelizerColor.uBucketData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);
                // gl.uniform1f(Programs.voxelizerColor.uPoints, 0);
                // gl.drawArraysInstanced(gl.POINTS, 0, response.amountOfTriangles, Math.pow(2 * this.ringsToVisit + 1, 3));


                // gl.disable(gl.BLEND);




                //Filter the data
                gl.useProgram(Programs.filterVoxels);
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, voxels);
                webGL2.bindTexture(Programs.filterVoxels.tData, voxelsTexture2, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


                //Apply the jump flood algorithm
                gl.useProgram(Programs.jumpFlood);
                gl.uniform3f(Programs.jumpFlood.uBucketData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);
                gl.uniform1f(Programs.jumpFlood.voxelResolution, this.voxelResolution);
                gl.uniform1f(Programs.jumpFlood.uTextSize, this.voxelsTextureSize);


                let passes = Math.log2(this.voxelResolution);
                let output, input;
                let i;
                for (i = 0; i < passes; i++) {
                    input = i % 2 == 0 ? voxelsTexture : voxelsTexture2;
                    output = i % 2 != 0 ? voxels : voxels2;
        
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, output);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    webGL2.bindTexture(Programs.jumpFlood.tJump, input, 0);
                    gl.uniform1f(Programs.jumpFlood.uOffset, Math.pow(2, passes - 1 - i));
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }

                input = i % 2 == 0 ? voxelsTexture : voxelsTexture2;
                output = i % 2 != 0 ? voxels : voxels2;

                //Calculate the distance from the jump flood
                gl.useProgram(Programs.jumpFloodDistance);
                gl.uniform3f(Programs.jumpFloodDistance.uBucketData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);
                gl.uniform1f(Programs.jumpFloodDistance.voxelResolution, this.voxelResolution);
                gl.uniform1f(Programs.jumpFloodDistance.uTextSize, this.voxelsTextureSize);
                webGL2.bindTexture(Programs.jumpFloodDistance.tJump, input, 0);
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, output);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                //Save the distance field in a 3d texture
                let distanceFieldTexture = webGL2.createTexture3D(this.voxelResolution, this.voxelResolution, this.voxelResolution, gl.RGBA32F, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.FLOAT, null);

                i++;
                input = i % 2 == 0 ? voxelsTexture : voxelsTexture2;
                output = i % 2 != 0 ? voxels : voxels2;

                gl.useProgram(Programs.arrayTo3D);
                gl.viewport(0, 0, this.voxelResolution, this.voxelResolution);
                webGL2.bindTexture(Programs.arrayTo3D.tData, input, 0);
                gl.uniform3f(Programs.arrayTo3D.voxelData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);

                let depth = distanceFieldTexture.depth / 4;
                for(let i = 0; i < depth; i ++) {
                    let framebuffer3D = webGL2.createFramebuffer3D(distanceFieldTexture, [4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3]);
                    gl.uniform4f(Programs.arrayTo3D.indices, 4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer3D);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer3D);
                    gl.deleteFramebuffer(framebuffer3D);
                }


                //Save the distance field in a 3d texture
                let coneTexture3D = webGL2.createTexture3D(this.voxelResolution, this.voxelResolution, this.voxelResolution, gl.RGBA32F, gl.RGBA, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR, gl.FLOAT, null);

   
                gl.useProgram(Programs.arrayTo3D);
                gl.viewport(0, 0, this.voxelResolution, this.voxelResolution);
                webGL2.bindTexture(Programs.arrayTo3D.tData, voxelConeTracing, 0);
                gl.uniform3f(Programs.arrayTo3D.voxelData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);

                depth = coneTexture3D.depth / 4;
                for(let i = 0; i < depth; i ++) {
                    let framebuffer3D = webGL2.createFramebuffer3D(coneTexture3D, [4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3]);
                    gl.uniform4f(Programs.arrayTo3D.indices, 4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer3D);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer3D);
                    gl.deleteFramebuffer(framebuffer3D);
                }


                gl.bindTexture(gl.TEXTURE_3D, coneTexture3D);
                gl.generateMipmap(gl.TEXTURE_3D);
                gl.bindTexture(gl.TEXTURE_3D, null);

                let result = {
                    id: response.id,
                    positionsTexture,
                    voxelsTexture: input,
                    distanceFieldTexture,
                    coneTexture: distanceColors,
                    coneTexture3D,
                    voxelsTextureSize: this.voxelsTextureSize,
                    amountOfTriangles: response.amountOfTriangles
                }


                resolve(result)
            };
        });

        worker.onmessage = (e) => {
            this.actionHandlerMap[id].call(this, e.data);
            delete this.actionHandlerMap[id];
            worker.terminate();
        };

        return workerResult;

    }

    //Voxelizes the mesh relative to the whole scene
    generate(id, mesh) {

        if (!mesh._voxelData) mesh._voxelData = this.prepareAndGetMeshData(mesh, id);

        return mesh._voxelData;
    }


}

export {DistanceFieldWebGL};