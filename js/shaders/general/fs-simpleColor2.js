const fsColor2 = `#version 300 es
    precision highp float;

    in vec4 colorData;
    in vec4 colorData2;

    layout(location=0) out vec4 color1;
    layout(location=1) out vec4 color2;

    void main() {
        color1 = colorData;
        color2 = colorData2;
    }
`;

export {fsColor2};