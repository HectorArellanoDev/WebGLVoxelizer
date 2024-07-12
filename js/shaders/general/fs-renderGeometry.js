const fsRenderGeometry = `#version 300 es
    precision highp float;
    precision highp sampler3D;


    uniform vec3 cameraPosition;
    uniform float time;
    uniform sampler3D tScene;
    uniform vec4 sceneData;
    uniform float uAlpha;
    uniform float useReflection;

    in vec3 vPos;
    in vec3 vNormal;

    out vec4 colorData;
    
    float sdBox( vec3 p, vec3 b ) {
      vec3 q = abs(p) - b;
      return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }
    
    float sceneSDF(vec3 pos) {
    
      vec3 uvw = pos;
      uvw -= sceneData.rgb;
      uvw /= (sceneData.a);
      return max(sdBox(uvw - vec3(0.5), vec3(.5)), 0.) + sceneData.a * texture(tScene, uvw).r;
    
    }
    
    vec4 getAmbientOcclusion(vec3 ro, vec3 rd) {
      vec4 totao = vec4(0.);
      float sca = 1.;
      float steps = 150.;
      for(float aoi = 3.; aoi < steps; aoi+=1.) {
        float hr = 0.0001 + 2. * aoi * aoi / (steps * steps);
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
    
    float softshadow( in vec3 ro, in vec3 rd, float mint, float maxt, float w ){
        float res = 1.0;
        float ph = 1e20;
        float t = mint;
        for( int i=0; i<50 && t<maxt; i++ )
        {
            float h = sceneSDF(ro + rd*t);
            if( h<0.045 )
                return 0.0;
            float y = h*h/(4.0*ph);
            float d = sqrt(h*h-y*y);
            res = min( res, d/(w*max(0.0,t-y)) );
            ph = h;
            t += h;
        }
        return res;
    }
    
    float map(vec3 eye, vec3 marchingDirection, float start, float end) {
        
        float depth = start;
        
        for (int i = 0; i < 100; i++) {
    
            float dist = sceneSDF(eye + depth * marchingDirection);
            float d = abs(dist);
            if (abs(dist) < 0.02) return depth;
    
            depth +=  d;
    
            if (depth >= end) {
                return end;
            }
    
        }
    
        return end;
    }
    
    vec3 calcNormal( in vec3 p ){
        const float h = 0.02; // replace by an appropriate value
        const vec2 k = vec2(1.,-1.);
        return normalize( k.xyy*sceneSDF( p + k.xyy*h ) + 
                          k.yyx*sceneSDF( p + k.yyx*h ) + 
                          k.yxy*sceneSDF( p + k.yxy*h ) + 
                          k.xxx*sceneSDF( p + k.xxx*h ) );
    }
    void main() {
    
        vec4 ao = getAmbientOcclusion(vPos, vNormal);
    
        float ambientTerm = 0.8;
    
        float lightAngle = time;
        vec3 lightPosition = 100. * vec3(cos(lightAngle), 1., sin(lightAngle));
        vec3 lightDirection = normalize(lightPosition - vPos);
    
        float shadows = softshadow(vPos + 0.08 * vNormal, lightDirection, 0., 6., 0.2);
    
        vec3 c = vec3(0.);
        float fresnel = 0.;
    
        if(useReflection > 0.) {
    
          vec3 eye = normalize(cameraPosition - vPos);
          vec3 reflectRay = reflect(vNormal, eye);
    
          float d = map(vPos + 0.1 * vNormal, reflectRay, 0., 2.);
    
          if(d < 2.) {
            c = vPos + d * reflectRay;
            vec3 normal = calcNormal(c);
            vec4 ao2 = getAmbientOcclusion(c, normal);
            lightDirection = normalize(lightDirection - c);
            float diffuse2 = max(dot(normal, lightDirection), 0.) * (1. - ambientTerm) + ambientTerm;
            c = vec3(1. - ao2.w) * diffuse2;
          }
    
          //Fresnel
          float n1 = 1.2;
          float n2 = 1.;
          float R0 = (n1 - n2) / (n1 + n2);
          R0 = R0 * R0;
          fresnel = R0 + (1. - R0) * pow(1. - max(dot(vNormal, eye), 0.), 1.);
    
        }
    
        float diffuse = max(dot(vNormal, lightDirection), 0.) * (1. - ambientTerm) + ambientTerm;
        colorData = vec4( c * fresnel + (1. - fresnel) * diffuse * vec3(1. - ao.w) * (ambientTerm + (1. - ambientTerm) * shadows), uAlpha );
        colorData.rgb = pow(colorData.rgb, vec3(0.4545));
    
    }
`;

export {fsRenderGeometry};