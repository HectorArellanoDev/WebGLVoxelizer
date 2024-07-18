const vsRenderGeometry = `#version 300 es

in vec3 position;
in vec3 normal;
in vec4 color;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 perspectiveMatrix;

out vec3 vNormal;
out vec3 vPos;
out vec4 vColor;
out vec3 vMPos;
out float vZ;

void main() {

    vec3 pos = position;

    vPos = pos;
    vNormal = normal.rgb;
    vColor = color;

    vMPos = vec3(modelViewMatrix * vec4(pos, 1.));

    gl_Position = perspectiveMatrix * modelViewMatrix * vec4(pos, 1.);

    vZ = gl_Position.z / gl_Position.w;
}
`;

export {vsRenderGeometry}
