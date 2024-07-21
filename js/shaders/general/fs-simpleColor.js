const fsColor = `#version 300 es
    precision highp float;

    in vec4 colorData;

    layout(location=0) out vec4 color1;

    void main() {
        color1 = colorData;
    }
`;

export {fsColor};