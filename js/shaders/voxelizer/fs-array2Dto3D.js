const fsArrayTo3D = `#version 300 es
    precision highp float;

    uniform sampler2D tData;
    uniform vec3 voxelData;
    uniform vec4 indices;

    in vec2 uv;

    layout(location=0) out vec4 data0;
    layout(location=1) out vec4 data1;
    layout(location=2) out vec4 data2;
    layout(location=3) out vec4 data3;

    ivec2 index2D(vec2 vUv, float index) {

        if(voxelData.z > -1.) {
            
            vec2 st = vUv / voxelData.z + vec2(mod(index, voxelData.z), floor(index / voxelData.z) ) / voxelData.z;
            return ivec2(floor(voxelData.x * st));

        } else {

            vec3 gridPosition = floor(vec3(gl_FragCoord.x, gl_FragCoord.y, index));
            float gridIndex = dot(gridPosition, vec3(1., voxelData.y, voxelData.y * voxelData.y));
            return ivec2(mod(gridIndex, voxelData.x), floor(gridIndex / voxelData.x));

        }	
    }

    vec4 dist(float index) {

        vec3 gridPosition = floor(vec3(gl_FragCoord.x, gl_FragCoord.y, index));
        gridPosition /= 128.;
        gridPosition -= vec3(.5);

        float d = length(gridPosition) - 0.3;
        d = min(d, length(gridPosition - vec3(0.2, 0., 0.)) - 0.2 );

        return vec4(d);
    }

    void main() {

        ivec2 i1 = index2D(uv, indices.x);
        ivec2 i2 = index2D(uv, indices.y);
        ivec2 i3 = index2D(uv, indices.z);
        ivec2 i4 = index2D(uv, indices.w);

        data0 = texelFetch(tData, i1, 0);
        data1 = texelFetch(tData, i2, 0);
        data2 = texelFetch(tData, i3, 0);
        data3 = texelFetch(tData, i4, 0);

        // data0 = dist(indices.x);
        // data1 = dist(indices.y);
        // data2 = dist(indices.z);
        // data3 = dist(indices.w);
            
    }

`;

export {fsArrayTo3D};