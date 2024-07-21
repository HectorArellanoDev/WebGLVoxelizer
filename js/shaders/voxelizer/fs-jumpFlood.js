const fsJumpFlood = `#version 300 es
    precision highp float;

    uniform sampler2D tJump;
    uniform float voxelResolution;
    uniform float uOffset;
    uniform float uTextSize;
    uniform vec3 uBucketData; //data is defined as: x = textureSize, y = resolution, z = layer size;

    out vec4 colorData;

    vec3 GetLocalCellPositionFromIndex(float localCellIndex, vec3 cellsPerDimensionLocal) {
    
        if(uBucketData.z > -1.) {

            //Texture is defined as buckets
            vec2 st = vec2(0.);
            st.x = mod(localCellIndex, uBucketData.x);
            st.y = floor(localCellIndex / uBucketData.x);

            float x = mod(st.x, voxelResolution);
            float y = mod(st.y, voxelResolution);
            float z = floor(st.x / voxelResolution) + uBucketData.z * floor(st.y / voxelResolution);

            return vec3(x, y, z);

        } else {

            float cellsPerLine = cellsPerDimensionLocal.x;
            float cellsPerPlane = cellsPerDimensionLocal.x * cellsPerDimensionLocal.y;

            float numPlanesZ = floor(localCellIndex / cellsPerPlane);
            float reminder = mod(localCellIndex, cellsPerPlane);

            float numLinesY = floor(reminder / cellsPerLine);
            float numCellX = mod(reminder, cellsPerLine);

            return vec3(numCellX, numLinesY, numPlanesZ);
        }
    }

    ivec2 index2D(vec3 gridPosition) {

        vec2 voxelPosition;
    
        if(uBucketData.z > -1.) {
            
            voxelPosition = gridPosition.xy + uBucketData.y * vec2(mod(gridPosition.z, uBucketData.z), floor(gridPosition.z / uBucketData.z));
        
        } else {
            
            float gridIndex = dot(gridPosition, vec3(1., uBucketData.y, uBucketData.y * uBucketData.y));
            voxelPosition = vec2(mod(gridIndex, uBucketData.x), floor(gridIndex / uBucketData.x));
        
        }

        return ivec2(voxelPosition);
    }

    ivec2 index2D(float index) {
        vec3 gridPosition = GetLocalCellPositionFromIndex(index, vec3(voxelResolution));
        return index2D(gridPosition);
    }

    void JumpSample(vec3 centerCoord, vec3 _offset, inout float bestDistance, inout float bestIndex) {

        vec3 sampleCoord = centerCoord + _offset;

        float voxelSampleIndex = texelFetch(tJump, index2D(sampleCoord), 0).x;

        vec3 voxelSampleCoord = GetLocalCellPositionFromIndex(voxelSampleIndex, vec3(voxelResolution));

        vec3 dd = centerCoord - voxelSampleCoord;
        float dist = length(dd);

        if(voxelSampleIndex != 0. && dist < bestDistance) {
            bestDistance = dist;
            bestIndex = voxelSampleIndex;
        }
    }

    void main() {

        vec2 uv = floor(gl_FragCoord.xy);

        float voxelIndex = uv.x + uv.y * uTextSize;

        if(voxelIndex >= pow(voxelResolution, 3.)) discard;

        vec3 centerCoord = GetLocalCellPositionFromIndex(voxelIndex, vec3(voxelResolution));

        float bestDistance = 1000000000000000000000000000000000.;
        float bestIndex = texelFetch(tJump, index2D(voxelIndex), 0).x;

        for(float z = -1.; z <= 1.; z++) { 
            for(float y = -1.; y <= 1.; y++) {
                for(float x = -1.; x <= 1.; x++) {
                    JumpSample(centerCoord, floor(vec3(x, y, z) * uOffset), bestDistance, bestIndex);
                }
            }
        }

        vec4 data = texelFetch(tJump, index2D(bestIndex), 0);

        colorData = vec4(bestIndex, data.yz, 1.);
    }

`;

export {fsJumpFlood};