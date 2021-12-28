uniform mat4 mModelView;
uniform mat4 mProjection;
uniform mat4 mModelViewNormals;

attribute vec4 vPosition;
attribute vec3 vNormal;

varying vec3 fNormal;
varying vec3 vP;
varying vec3 vN;

void main() {
    gl_Position = mProjection * mModelView * vPosition;
    vP = (mModelView * vPosition).xyz;
    vN = (mModelViewNormals * vec4(vNormal, 0.0)).xyz;
    fNormal = vNormal;
}