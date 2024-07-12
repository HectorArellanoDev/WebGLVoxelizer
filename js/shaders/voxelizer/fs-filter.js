const fsFilter = `#version 300 es
    precision highp float;

    uniform sampler2D tData;
    out vec4 color;

    void main() {
        
        ivec2 uv = ivec2(floor(gl_FragCoord.xy));
        vec4 data = texelFetch(tData, uv, 0);
        color = float(data.y < 0.02) * data;

    }
`;

export {fsFilter};