const fsBlur = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D tData;
uniform sampler2D tDepth;
uniform vec2 uAxis;

in vec2 uv;
out vec4 colorData;


void main(void) {

    float sum = 1.;
    float m = 1.;
    int depth = int(abs(0. * texture(tDepth, uv).r));
    vec4 blend = vec4(0.);
    float n = float(depth);
    for (int i = 0; i <= depth; i += 1) {
        float k = float(i);
        float j = float(i) - 0.5 * n;
        blend += m * texture(tData, uv + j * uAxis.xy);
        m *= (n - k) / (k + 1.);
        sum += m;
    } 
    blend /= sum;

    colorData = blend;
}
`;

export {fsBlur}


