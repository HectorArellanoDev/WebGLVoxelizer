const vsRenderGeometry = `#version 300 es

in vec4 position;
in vec4 normal;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 perspectiveMatrix;

out vec3 vNormal;
out vec3 vPos;

void main() {

    vPos = vec3(modelMatrix * position);
    vNormal = normal.rgb;

    gl_Position = perspectiveMatrix * modelViewMatrix * position;

}
`;

export {vsRenderGeometry}
