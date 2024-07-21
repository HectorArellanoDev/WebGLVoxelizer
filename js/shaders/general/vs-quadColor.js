const vsQuadColor = `#version 300 es

out vec2 uv;
out vec4 colorData;
out vec4 colorData2;

void main() {
    int index = gl_VertexID;
    
    vec2 position = 2. * vec2(float(index % 2), float(index / 2)) - vec2(1.);
    uv = 0.5 * position + vec2(0.5);
    colorData = vec4(10000000000.);

    gl_Position = vec4(position, 0.99999, 1.);
}

`;

export {vsQuadColor}