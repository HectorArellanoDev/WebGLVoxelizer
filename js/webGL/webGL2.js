
//=======================================================================================================
// Variables
//=======================================================================================================

let gl;
let contextReady = false;

Promise.create = function() {
    const promise = new Promise((resolve, reject) => {
        this.temp_resolve = resolve;
        this.temp_reject = reject;
    });
    promise.resolve = this.temp_resolve;
    promise.reject = this.temp_reject;
    delete this.temp_resolve;
    delete this.temp_reject;
    return promise;
};

//=======================================================================================================
// Public functions
//=======================================================================================================

//Generate the context using the provided canvas
const setContext = canvas => {
    gl = canvas.getContext('webgl2');

    //Load the extension to draw inside floating point textures
    gl.getExtension('EXT_color_buffer_float');

    //Load the extension to have linear interpolatino for floating point textures
    gl.getExtension("OES_texture_float_linear");

    contextReady = true;
}

//Generates a program from a vertex and fragment shader
const generateProgram = (vertexShader, fragmentShader) => {
    if(contextReady) {
        let program = gl.createProgram();
        gl.attachShader(program, getShader(vertexShader, 0));
        gl.attachShader(program, getShader(fragmentShader, 1));
        gl.linkProgram(program);
        if (! gl.getProgramParameter( program,  gl.LINK_STATUS)) {
            console.log(new Error("Could not generate the program"));
            return null;
        }
        return program;
    } else {
        console.log(new Error("Context not set yet"));
    }
}

//Function used to genarate an array buffer
const createBuffer = data => {
    if(contextReady) {
        let buffer =  gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, buffer);
        gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(data),  gl.STATIC_DRAW);
        gl.bindBuffer( gl.ARRAY_BUFFER, null);
        return buffer;
    } else {
        console.log(new Error("Context not set yet"));
    }
}

//Function used to generate an empty texture2D
let memory = 0;
const createTexture2D = (width, height, internalFormat, format, maxFilter, minFilter, type, data = null, wrap = gl.CLAMP_TO_EDGE) => {
    if(contextReady) {
        let texture = gl.createTexture();
        texture.width = width;
        texture.height = height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, maxFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

        gl.bindTexture(gl.TEXTURE_2D, null);

        if(type == gl.FLOAT) memory += width * height * 32 * 4;
        else memory += width * height * 8 * 4;

        let m = memory / 8; //<----- bits to bytes
        m /= 1000000; //<----- bytes to mega bytes

        // console.log("current GPU memory usage: " + m + " Mb");

        return texture;
    } else {
        console.log(new Error("Content not set yet"));
    }
}

const createFramebuffer3D = (texture, indices) => {

    if(contextReady) {

        let buffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
        let colorAttachments = [];

        for(let i = 0; i < indices.length; i ++) {
            let key = 'COLOR_ATTACHMENT' + i;
            colorAttachments.push(gl[key]);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl[key], texture, 0, indices[i]);
        }

        gl.drawBuffers(colorAttachments);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return buffer;

    } else {
        
        console.log(new Error("Content not set yet"));

    }
} 

//Function used to generate an empty texture3D
const createTexture3D = (width, height, depth, internalFormat, format, maxFilter, minFilter, type, data = null, wrap = gl.CLAMP_TO_EDGE) => {
    if(contextReady) {
        let texture = gl.createTexture();
        texture.width = width;
        texture.height = height;
        texture.depth = depth;
        gl.bindTexture(gl.TEXTURE_3D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, maxFilter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, wrap);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, wrap);

        gl.texImage3D(gl.TEXTURE_3D,
            0,
            internalFormat,
            width,
            height,
            depth,
            0,
            format,
            type,
            null);

        gl.bindTexture(gl.TEXTURE_3D, null);

        if(type == gl.FLOAT) memory += width * height * 32 * 4;
        else memory += width * height * 8 * 4;

        let m = memory / 8; //<----- bits to bytes
        m /= 1000000; //<----- bytes to mega bytes

        // console.log("current GPU memory usage: " + m + " Mb");

        return texture;
    } else {
        console.log(new Error("Content not set yet"));
    }
}

//Function used for texture binding
const bindTexture = (programData, texture, texturePos, is3D = false) => {
    if(contextReady) {
        let textures = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3, gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7, gl.TEXTURE8, gl.TEXTURE9, gl.TEXTURE10, gl.TEXTURE11, gl.TEXTURE12, gl.TEXTURE13, gl.TEXTURE14];
        gl.activeTexture(textures[texturePos]);
        gl.bindTexture(is3D ? gl.TEXTURE_3D : gl.TEXTURE_2D, texture);
        gl.uniform1i(programData, texturePos);
    } else {
        console.log(new Error("Content not set yet"));
    }
}

//Function used to generate multiple drawing buffers
const createDrawFramebuffer = (_textures, useDepth = false, useStencil = false) => {
    if(contextReady) {

        //This allows to either have a single texture as input or an array of textures
        let textures = _textures.length == undefined ? [_textures] : _textures;

        let frameData = gl.createFramebuffer();
        let colorAttachments = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3, gl.COLOR_ATTACHMENT4, gl.COLOR_ATTACHMENT5, gl.COLOR_ATTACHMENT6];
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, frameData);
        frameData.width = textures[0].width;
        frameData.height = textures[0].height;
        let drawBuffers = [];
        for(let i = 0; i < textures.length; i ++) {
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, colorAttachments[i], gl.TEXTURE_2D, textures[i], 0);
            drawBuffers.push(colorAttachments[i]);
        }
        if(useDepth) {
            let renderbuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, textures[0].width, textures[0].height);
            if(useStencil) {
                gl.renderbufferStorage( gl.RENDERBUFFER, gl.DEPTH_STENCIL,  textures[0].width, textures[0].height);
                gl.framebufferRenderbuffer( gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
            } else {
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
            }
        }
        gl.drawBuffers(drawBuffers);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

        let status = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER);
        if (status != gl.FRAMEBUFFER_COMPLETE) {
            console.log('fb status: ' + status.toString(16));
            return null;
        }

        return frameData;
    } else {
        console.log(new Error("Content not set yet"));
    }
}

async function get(path) {

    let result;
    let ready = Promise.create();
    fetch(path).then(data => {
        data.json().then( response => {
            result = response;
            ready.resolve();
        })
    })
    
    await ready;
    return result;
}

async function loadGeometry(path, centerGeometry = false) {

    let response = await get(path);
    let result = response?.data?.attributes || response;

    let index = response?.data?.index?.array || [];
    let buffersData = {}
    let buffers = {};

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;

    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    let indexed = index.length > 0;

    for(let id in result) {

        const data = new Float32Array(result[id]?.array || result[id]);

        if(centerGeometry && id == "position") {

            let totalVertices = 0;
            let centerX = 0;
            let centerY = 0;
            let centerZ = 0;

            for(let j = 0; j < data.length / 3; j += 3) {
                centerX += data[3 * j + 0];
                centerY += data[3 * j + 1];
                centerZ += data[3 * j + 2];
                totalVertices ++;
            }

            centerX /= totalVertices;
            centerY /= totalVertices;
            centerZ /= totalVertices;

            for(let i = 0; i < data.length / 3; i += 1) {
                data[3 * i + 0] -= centerX;
                data[3 * i + 1] -= centerY;
                data[3 * i + 2] -= centerZ;
            }
            
        }

        let orderedData = data;

        if((id == "position" || id == "normal")) {

            orderedData = [];

            let total = indexed ? index.length : data.length;
            let sum = indexed ? 1 : 3;

            for(let i = 0; i < total; i += sum) {
                let j = indexed ? index[i] : i;

                let _x = data[3 * j + 0];
                let _y = data[3 * j + 1];
                let _z = data[3 * j + 2];

                if(id == "position") {
                    minX = Math.min(minX, _x);
                    minY = Math.min(minY, _y);
                    minZ = Math.min(minZ, _z);

                    maxX = Math.max(maxX, _x);
                    maxY = Math.max(maxY, _y);
                    maxZ = Math.max(maxZ, _z);
                }

                orderedData.push(_x);
                orderedData.push(_y);
                orderedData.push(_z);

            }

            buffers.length = orderedData.length / 3;
            orderedData = new Float32Array(orderedData);
        }

        buffersData[id] = orderedData;

    }

    buffers.min = {x: minX, y: minY, z: minZ};
    buffers.max = {x: maxX, y: maxY, z: maxZ};
    buffers.scale = Math.max(maxX - minX, Math.max(maxY - minY, maxZ - minZ));
    buffers["position"] = createBuffer(buffersData["position"]);
    buffers["normal"] = createBuffer(buffersData["normal"]);
    buffers.positionArray = buffersData["position"];

    return buffers;
}


export {
    gl,
    setContext,
    generateProgram,
    createTexture2D,
    createTexture3D,
    bindTexture,
    createBuffer,
    createDrawFramebuffer,
    createFramebuffer3D,
    loadGeometry
}

//=======================================================================================================
// Private functions
//=======================================================================================================

const getShader = (str, type) => {
    let shader;
    if (type == 1) {
        shader =  gl.createShader( gl.FRAGMENT_SHADER);
    } else  {
        shader =  gl.createShader( gl.VERTEX_SHADER);
    }
    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (! gl.getShaderParameter(shader,  gl.COMPILE_STATUS)) {
        console.log(new Error("Could not generate the program"));
        console.log( gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}
