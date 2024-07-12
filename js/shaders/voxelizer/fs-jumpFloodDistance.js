const fsJumpFloodDistance = `#version 300 es
    precision highp float;

    uniform sampler2D tJump;
    uniform float voxelResolution;
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

    void main() {

        vec2 uv = floor(gl_FragCoord.xy);

        float voxelIndex = uv.x + uv.y * uTextSize;

        if(voxelIndex >= pow(voxelResolution, 3.)) discard;

        ivec2 st = index2D(voxelIndex);

        float closestSeedVoxelIndex = texelFetch(tJump, st, 0).x;
        
        vec3 dd = GetLocalCellPositionFromIndex(voxelIndex, vec3(voxelResolution)) - GetLocalCellPositionFromIndex(closestSeedVoxelIndex, vec3(voxelResolution));
        float distanceToClosestSeedVoxel = length(dd) / (voxelResolution);

        float distanceOfClosestSeedVoxelToSurface = texelFetch(tJump, index2D(closestSeedVoxelIndex), 0).y;
        
        colorData = vec4(distanceToClosestSeedVoxel + distanceOfClosestSeedVoxelToSurface);
    }
`;

export {fsJumpFloodDistance};