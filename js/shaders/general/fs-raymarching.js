const fsRaymarching = `#version 300 es
    precision highp float;
    precision highp sampler3D;

    uniform sampler3D tData;
    uniform vec2 resolution;
    uniform mat4 cameraOrientation;
    uniform vec3 cameraPosition;

    const int MAX_MARCHING_STEPS = 400;
    const float MIN_DIST = 0.0;
    const float MAX_DIST = 2.;
    const float EPSILON = 0.004;

    out vec4 colorData;

    //Ray box intersection function
    float boxRay(vec3 ro, vec3 rd, vec3 boxmin, vec3 boxmax) {
        vec3 invR = 1. / rd;
        vec3 tbot = invR * (boxmin - ro);
        vec3 ttop = invR * (boxmax - ro);
        vec3 tmin = min(ttop, tbot);
        vec3 tmax = max(ttop, tbot);
        vec2 t0 = max(tmin.xx, tmin.yz);
        float tnear = max(t0.x, t0.y);
        t0 = min(tmax.xx, tmax.yz);
        float tfar = min(t0.x, t0.y);
        if( tnear > tfar || tfar < 0.0) return -1.;
        return tnear;
    }

    float sdBox( vec3 p, vec3 b ) {
      vec3 q = abs(p) - b;
      return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }

    float sceneSDF(vec3 samplePoint) {

        return max(sdBox(samplePoint, vec3(0.5, 0.5, 0.5)), texture(tData, samplePoint + vec3(0.5)).a);

    }


    //Mapping function used for raymarching
    float map(vec3 eye, vec3 marchingDirection, float start, float end) {
        
        float depth = start;

        for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        
            float dist = sceneSDF(eye + depth * marchingDirection);

            if ((dist) < EPSILON) {
                return depth;
            }

            depth += dist / 8.;

            if (depth >= end) {
                return end;
            }
            
        }
        return end;
    }



    vec3 calcNormal(vec3 p) {
        float eps = 0.0015;
        return normalize(vec3(
            sceneSDF(vec3(p.x + eps, p.y, p.z)) - sceneSDF(vec3(p.x - eps, p.y, p.z)),
            sceneSDF(vec3(p.x, p.y + eps, p.z)) - sceneSDF(vec3(p.x, p.y - eps, p.z)),
            sceneSDF(vec3(p.x, p.y, p.z + eps)) - sceneSDF(vec3(p.x, p.y, p.z - eps))
        ));
    }

    vec4 getAmbientOcclusion(vec3 ro, vec3 rd) {
    vec4 totao = vec4(0.);
    float sca = 1.;
    float steps = 200.;
    for(float aoi = 10.; aoi < steps; aoi+=1.) {
        float hr = 0.001 + 2. * aoi * aoi / (steps * steps);
        vec3 p = ro + rd * hr;
        float dd = sceneSDF(p);
        float ao = 0.;
        if(dd <= hr) {
        ao = clamp((hr - dd), 0., 1.);
        }
        totao += ao * sca * vec4(1.);
        sca *= 0.94;
    }
    float aoCoef = 1.;
    totao = vec4(totao.rgb, clamp(aoCoef * totao.w, 0., 1.));
    return totao;
    }


    void main() {

        colorData = vec4(0.);

        //Generate a ray with the caamera orientation.

        vec2 xy = (2.0 * gl_FragCoord.xy - resolution.xy)/resolution.y;

        float z = resolution.y / tan(radians(35.) / 2.0);
        vec3 dir =  normalize(vec3(xy, -z / resolution.y));
        dir = normalize(dir);

        vec3 eye = vec3(0.0, 0.0, length(cameraPosition) * 0.2);

        eye = vec3(inverse(cameraOrientation) * vec4(eye, 1.));
        dir = vec3(inverse(cameraOrientation) * vec4(dir, 1.));

        //Find the collision point between the ray and the bounding box of the texture
        //this discard fragments that won't contribute (rendered in white)
        float t = boxRay(eye, dir, vec3(-0.5), vec3(0.5));

        if(t == -1.) {
            //Case where there's no intersection with the bounding box
            colorData = vec4(1., 0., 0., 1.);
            return;
        } 


        //If there's an intersection the new starting point is used
        //as the initial point of the distance field.
        vec3 position3D = eye + t * dir;
        // colorData = vec4(position3D, 1.);
        // return;


        float dist = map(position3D, dir, MIN_DIST, MAX_DIST);

        if(dist >= MAX_DIST - EPSILON) {
            colorData = vec4(0., 0., 1., 1.);
            return;
        }

        //Renders the position found.
        position3D += dir * dist ;

        //Get the color
        vec3 colorRGB = texture(tData, position3D + vec3(0.5)).rgb;


        vec3 normal = calcNormal(position3D);

        vec4 ao = getAmbientOcclusion(position3D, normal);

        colorData = vec4(colorRGB * (1. - ao.w), 1.);

    }


`;

export {fsRaymarching};