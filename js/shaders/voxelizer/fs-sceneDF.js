const fsSceneDF = `#version 300 es

    precision highp float;
    precision highp sampler3D;

    uniform float voxelResolution;
    uniform vec4 uData0;
    uniform vec4 indices;

    uniform sampler3D tDistance1;
    uniform vec4 uData1;
    uniform mat4 uMatrix1;

    uniform sampler3D tDistance2;
    uniform vec4 uData2;
    uniform mat4 uMatrix2;

    uniform sampler3D tDistance3;
    uniform vec4 uData3;
    uniform mat4 uMatrix3;

    uniform sampler3D tDistance4;
    uniform vec4 uData4;
    uniform mat4 uMatrix4;

    precision highp float;
        
    layout(location=0) out vec4 texel0;
    layout(location=1) out vec4 texel1;
    layout(location=2) out vec4 texel2;
    layout(location=3) out vec4 texel3;

    float sdBox( vec3 p, vec3 b ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }

    float shapeSDF(vec3 pos, sampler3D tData, vec4 shapeData, mat4 matrixData) {

    vec3 uvw = pos;

    uvw = vec3(matrixData * vec4(uvw, 1.));

    uvw -= shapeData.rgb;
    float padding = 0.05;
    uvw += padding;
    uvw /= (shapeData.a + 2. * padding);

    float d = max(sdBox(uvw - vec3(0.5), vec3(.5)), 0.) / uData0.a + shapeData.a * texture(tData, uvw).r / uData0.a;

    return d;

    }

    float sceneSDF(vec3 pos) {

    float d = pos.y + 0.2;

    d = min(d, shapeSDF(pos, tDistance1, uData1, inverse(uMatrix1)));

    d = min(d, shapeSDF(pos, tDistance2, uData2, inverse(uMatrix2)));

    d = min(d, shapeSDF(pos, tDistance3, uData3, inverse(uMatrix3)));

    d = min(d, shapeSDF(pos, tDistance4, uData4, inverse(uMatrix4)));

    return d;
    }


    void main() {

        //2D layer position
        vec2 xy = floor(gl_FragCoord.xy);

        texel0 = vec4(sceneSDF( uData0.rgb + uData0.a * vec3(xy, indices.x) / voxelResolution ));
        texel1 = vec4(sceneSDF( uData0.rgb + uData0.a * vec3(xy, indices.y) / voxelResolution ));
        texel2 = vec4(sceneSDF( uData0.rgb + uData0.a * vec3(xy, indices.z) / voxelResolution ));
        texel3 = vec4(sceneSDF( uData0.rgb + uData0.a * vec3(xy, indices.w) / voxelResolution ));

    }
`;

export {fsSceneDF};