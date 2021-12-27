uniform mat4 mModelView;
uniform mat4 mProjection;
uniform mat4 mView;
uniform mat4 mModelNormals;
uniform mat4 mModelViewNormals;
uniform mat4 mModel;
uniform mat4 mNormals;

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