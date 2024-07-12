const vsVoxelizer = `#version 300 es

uniform sampler2D tPositions;
uniform vec3 uSize;
uniform vec3 uMin;
uniform float uScaleVoxel;
uniform float uDataTextureSize;
uniform vec3 uBucketData; //data is defined as: x = textureSize, y = resolution, z = layer size;
uniform float uPoints;
uniform float uRings;

out vec4 colorData;

vec3 g_CellSize = vec3(0.);
int g_NumCellsX = 0;
int g_NumCellsY = 0;
int g_NumCellsZ = 0;
vec3 MARGIN = vec3(0.);
ivec3 GRID_MARGIN = ivec3(0);

vec3 GetSdfCellPosition(vec3 gridPosition) {
    vec3 cellCenter = vec3(gridPosition);
    cellCenter = cellCenter + vec3(0.5);
	cellCenter = cellCenter * g_CellSize;
    return cellCenter;
}

ivec3 GetSdfCoordinates(vec3 positionInWorld) {
    vec3 sdfPosition = positionInWorld / g_CellSize;
     return ivec3(int(sdfPosition.x), int(sdfPosition.y), int(sdfPosition.z));  
}

int GetSdfCellIndex(ivec3 gridPosition) {
    return g_NumCellsX * g_NumCellsZ * gridPosition.y + g_NumCellsX * gridPosition.z + gridPosition.x;
}

float DistancePointToEdge(vec3 p, vec3 s0, vec3 s1, inout vec3 n) {
    
    vec3 x0 = s0;
    vec3 x1 = s1;

    if (x0.x > x1.x) {
		vec3 temp = x0;
		x0 = x1;
		x1 = temp;
	}

    vec3 x10 = x1 - x0;

	float t = dot(x1 - p, x10) / dot(x10, x10);
	t = max(0.0, min(t, 1.0));

	vec3 a = p - (t*x0 + (1.0 - t)*x1);
	float d = length(a);
	n = a / (d + 1e-30);

	return d;
    
}

float SignedDistancePointToTriangle(vec3 p, vec3 x0, vec3 x1, vec3 x2, inout vec3 n) {

    float d = 0.;
	vec3 x02 = x0 - x2;
	float l0 = length(x02) + 1e-20;
	x02 = x02 / l0;
	vec3 x12 = x1 - x2;
	float l1 = dot(x12, x02);
	x12 = x12 - l1*x02;
	float l2 = length(x12) + 1e-20;
	x12 = x12 / l2;
	vec3 px2 = p - x2;

	float b = dot(x12, px2) / l2;
	float a = (dot(x02, px2) - l1*b) / l0;
	float c = 1. - a - b;

    // normal vector of triangle. Don't need to normalize this yet.
	vec3 nTri = cross((x1 - x0), (x2 - x0));
	float tol = 1e-8;

    if (a >= -tol && b >= -tol && c >= -tol) {
		n = p - (a*x0 + b*x1 + c*x2);
		d = length(n);

		vec3 n1 = n / d;
		vec3 n2 = nTri / (length(nTri) + 1e-20);		// if d == 0

		n = (d > 0.) ? n1 : n2;

	} else {

		vec3 n_12 = vec3(0.);
		vec3 n_02 = vec3(0.);

		d = DistancePointToEdge(p, x0, x1, n);

		float d12 = DistancePointToEdge(p, x1, x2, n_12);
		float d02 = DistancePointToEdge(p, x0, x2, n_02);

		d = min(d, d12);
		d = min(d, d02);

		n = (d == d12) ? n_12 : n;
		n = (d == d02) ? n_02 : n;
	}

    //#ifdef SIGNED
        //d = (dot(p - x0, nTri) < 0.f) ? -d : d;
    //#endif

	//n = normalize(nTri);
	return d;

}

ivec2 index2D(float index) {
    int _x = int(mod(index, uDataTextureSize));
    int _y = int(floor(index / uDataTextureSize));
    return ivec2(_x, _y);
}

void main() {

	//GPGPU happens in the vertex shader since it requires
	//scattering of data into a 3d texture.

    //The vertex id can be used to define the triangle that the shader is
    //working on, this way we can retrieve the vertices from the textures

	float scaler = uPoints ==  0. ? 3. : 1.;
    float triangleIndex = scaler * float(gl_VertexID);

	g_CellSize = 1. / uSize;
	g_NumCellsX = int(uSize.x);
	g_NumCellsY = int(uSize.y);
	g_NumCellsZ = int(uSize.z);
	MARGIN = g_CellSize;
	GRID_MARGIN = ivec3(0, 0, 0);


    float padding = 0.05;
	vec2 voxelPosition = vec2(0.);
	vec2 vp = vec2(0.);
	

	//For triangles
	vec3 tri0 = texelFetch(tPositions, index2D(triangleIndex), 0).rgb;
	vec3 tri1 = texelFetch(tPositions, index2D(triangleIndex + 1.), 0).rgb;
	vec3 tri2 = texelFetch(tPositions, index2D(triangleIndex + 2.), 0).rgb;

    tri0 = (tri0 - uMin + padding) / (uScaleVoxel + 2. * padding);
	tri1 = (tri1 - uMin + padding) / (uScaleVoxel + 2. * padding);
	tri2 = (tri2 - uMin + padding) / (uScaleVoxel + 2. * padding);


	float lr = 2. * uRings + 1.;
	float offsetIndex = float(gl_InstanceID);
	float cellsPerLine = lr;
	float cellsPerPlane = lr * lr;
	float numPlanesZ = floor(offsetIndex / cellsPerPlane);
	float reminder = mod(offsetIndex, cellsPerPlane);
	float numLinesY = floor(reminder / cellsPerLine);
	float numCellX = mod(reminder, cellsPerLine);
	ivec3 offset = ivec3(numCellX - uRings, numLinesY - uRings, numPlanesZ - uRings);


	vec3 averagePosition = uPoints > 0. ? tri0 : ( tri0 + tri1 + tri2 ) / 3.;
	ivec3 gridCellCoordinate = GetSdfCoordinates( averagePosition ) + offset;
	vec3 cellPosition = GetSdfCellPosition( vec3(gridCellCoordinate) );
	vec3 normal = vec3(0.);
	float dist = 100.;

	if(uPoints > 0.) {
		dist = length(cellPosition - averagePosition);
	} else {
		dist = SignedDistancePointToTriangle( cellPosition, tri0, tri1, tri2, normal);
	}
	
	
	vec3 gridPosition = vec3(gridCellCoordinate);

	if(uBucketData.z > -1.) {
		
		vp = gridPosition.xy + uBucketData.y * vec2(mod(gridPosition.z, uBucketData.z), floor(gridPosition.z / uBucketData.z)) + vec2(0.5);
	
	} else {
		
		float gridIndex = dot(gridPosition, vec3(1., uBucketData.y, uBucketData.y * uBucketData.y));
		vp = vec2(mod(gridIndex, uBucketData.x), floor(gridIndex / uBucketData.x)) + vec2(0.5);
	
	}

	voxelPosition =  2. * vp / uBucketData.x - vec2(1.);

	vp -= vec2(0.5);
	float id = floor(vp.x + vp.y * uBucketData.x);
	colorData = vec4(id, dist, 0., 1.);
	 
    //Rendering as points to save data scattered in a texture
	gl_PointSize = 1.;
	gl_Position = vec4(voxelPosition, 0., 1.0);

}

`;

export {vsVoxelizer}
