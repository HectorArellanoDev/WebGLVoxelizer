const fsTexture = `#version 300 es
    precision highp float;

    uniform sampler2D uTexture;
    in vec2 uv;
    out vec4 color;

    void main() {
        color = texture(uTexture, uv);
    }
`;

export {fsTexture};