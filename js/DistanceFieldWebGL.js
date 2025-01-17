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
        let scale = geom.scale;

        let worker = new Worker("./js/triangleSplitter.js");

        let workerResult = new Promise((resolve, reject) => {

            worker.postMessage([id, positions, scale]);

            this.actionHandlerMap[id] = response => {

                let positionsTexture = webGL2.createTexture2D(response.textureSize, response.textureSize, gl.RGB32F, gl.RGB, gl.NEAREST, gl.NEAREST, gl.FLOAT, response.positionsData);
                let voxelsTexture = webGL2.createTexture2D(this.voxelsTextureSize, this.voxelsTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, null);
                let voxelsTexture2 = webGL2.createTexture2D(this.voxelsTextureSize, this.voxelsTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, null);

                let voxels = webGL2.createDrawFramebuffer(voxelsTexture);
                let voxels2 = webGL2.createDrawFramebuffer(voxelsTexture2);

                gl.viewport(0, 0, this.voxelsTextureSize, this.voxelsTextureSize);

                //Calculate the voxelization
                gl.useProgram(Programs.voxelizer);
                gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, voxels2);
                gl.disable(gl.DEPTH_TEST);

                gl.enable(gl.BLEND);
                gl.blendEquation(gl.MIN);

                gl.clearColor(100000000000, 100000000000, 100000000000, 100000000000);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                gl.clearColor(0, 0, 0, 0);

                webGL2.bindTexture(Programs.voxelizer.tPositions, positionsTexture, 0);
                gl.uniform3f(Programs.voxelizer.uSize, this.voxelResolution, this.voxelResolution, this.voxelResolution);
                gl.uniform3f(Programs.voxelizer.uMin, geom.min.x, geom.min.y, geom.min.z);
                gl.uniform1f(Programs.voxelizer.uRings, this.ringsToVisit);
                gl.uniform1f(Programs.voxelizer.uScaleVoxel, geom.scale);
                gl.uniform1f(Programs.voxelizer.uDataTextureSize, response.textureSize);
                gl.uniform3f(Programs.voxelizer.uBucketData, this.voxelsTextureSize, this.voxelResolution, this.layerSize);
                gl.uniform1f(Programs.voxelizer.uPoints, 0);

                gl.drawArraysInstanced(gl.POINTS, 0, response.amountOfTriangles, Math.pow(2 * this.ringsToVisit + 1, 3));
                gl.disable(gl.BLEND);


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
                let distanceFieldTexture = webGL2.createTexture3D(this.voxelResolution, this.voxelResolution, this.voxelResolution, gl.R32F, gl.RED, gl.LINEAR, gl.LINEAR, gl.FLOAT, null);

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
                }

                let result = {
                    id: response.id,
                    positionsTexture,
                    voxelsTexture: input,
                    distanceFieldTexture,
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