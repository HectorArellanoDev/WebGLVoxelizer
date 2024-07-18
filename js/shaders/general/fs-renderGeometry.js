const fsRenderGeometry = `#version 300 es
    precision highp float;
    precision highp sampler3D;


    uniform vec3 cameraPosition;
    uniform float time;
    uniform sampler3D tScene;
    uniform sampler3D tCone;
    uniform sampler2D tMatcap;

    uniform vec4 sceneData;
    uniform float uAlpha;
    uniform float useReflection;
    uniform float uReady;

    in vec3 vPos;
    in vec3 vNormal;
    in vec4 vColor;
    in vec3 vMPos;
    in float vZ;

    layout(location=0) out vec4 colorData1;
    layout(location=1) out vec4 colorData2;

    float sdBox( vec3 p, vec3 b ) {
      vec3 q = abs(p) - b;
      return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }
    
    float sceneSDF(vec3 pos) {
    
      vec3 uvw = pos;
      return texture(tScene, uvw).r;
    
    }
    
    vec4 getAmbientOcclusion(vec3 ro, vec3 rd) {
      vec4 totao = vec4(0.);
      float sca = 1.;
      float steps = 400.;
      for(float aoi = 2.; aoi < steps; aoi+=1.) {
        float hr = 0.01 + 2. * aoi * aoi / (steps * steps);
        vec3 p = ro + rd * hr;
        float dd = sceneSDF(p);
        float ao = 0.;
        if(dd <= hr) {
          ao = clamp((hr - dd), 0., 1.);
        }
        totao += ao * sca * vec4(1.);
        sca *= 0.972;
      }
      float aoCoef = 1.;
      totao = vec4(totao.rgb, clamp(aoCoef * totao.w, 0., 1.));
      return totao;
    }
    
    float softshadow( in vec3 ro, in vec3 rd, float mint, float maxt, float w ){
        float res = 1.0;
        float ph = 1e20;
        float t = mint;
        for( int i=0; i<150 && t<maxt; i++ )
        {
            float h = sceneSDF(ro + rd*t);
            if( h<0.0045 )
                return 0.0;
            float y = h*h/(4.0*ph);
            float d = sqrt(h*h-y*y);
            res = min( res, d/(w*max(0.0,t-y)) );
            ph = h;
            t += h;
        }
        return res;
    }
        
    vec3 calcNormal( in vec3 p ){
        const float h = 0.003; // replace by an appropriate value
        const vec2 k = vec2(1.,-1.);
        return normalize( k.xyy*sceneSDF( p + k.xyy*h ) + 
                          k.yyx*sceneSDF( p + k.yyx*h ) + 
                          k.yxy*sceneSDF( p + k.yxy*h ) + 
                          k.xxx*sceneSDF( p + k.xxx*h ) );
    }




    const float MAX_DISTANCE = 2.;
    const float MAX_ALPHA = 0.95;
    float voxelWorldSize = 1. / 256.;

    vec4 voxelTracing(vec3 startPos, vec3 direction, float tanHalfAngle) {
      float lod = 0.0;
      vec3 color = vec3(0.0);
      float alpha = 0.0;
      float occlusion = 0.0;

      //Voxel Cube Size
      float dist = voxelWorldSize;

      while(dist < MAX_DISTANCE && alpha < MAX_ALPHA) {
        float diameter = max(voxelWorldSize, 2.0 * tanHalfAngle * dist);
        float lodLevel = log2(diameter / voxelWorldSize);
        vec4 voxelColor = textureLod(tCone, startPos + dist * direction, lodLevel);
        float sub = 1. - alpha;
        float aa = pow(voxelColor.a, 1.);
        alpha += sub * aa;
        occlusion += sub * aa / (1.0 + 0.03 * diameter);
        color += sub * voxelColor.rgb;
        dist += diameter;
      }

      return vec4(color, clamp(1. -  occlusion, 0., 1.) );
    }

    void main() {

        vec3 pos = (vPos - sceneData.rgb) / sceneData.a;

        vec4 ao = getAmbientOcclusion(pos + 0.01 * vNormal, vNormal);
    
        float ambientTerm = .0;
    
        float lightAngle = 0.;
        vec3 lightPosition = 2. * vec3(cos(lightAngle), 1., sin(lightAngle));
        vec3 lightDirection = normalize(lightPosition - pos);

    
        float shadows = softshadow(pos + 0.01 * vNormal, lightDirection, 0., 2., 0.2);
    
        vec3 c = vec3(0.);
        float fresnel = 0.;


        

        //Fresnel
        vec3 eye =  normalize(cameraPosition - vPos);
        float n1 = 1.;
        float n2 = 1.;
        float R0 = (n1 - n2) / (n1 + n2);
        R0 = R0 * R0;
        fresnel = R0 + (1. - R0) * pow(1. - max(dot(vNormal, -eye), 0.), 1.);
        fresnel = fresnel;



        //For the matcap
        vec3 e = normalize(cameraPosition - vPos);
        vec3 r = reflect(-e, vNormal);
        float m = 2.0 * sqrt(
        pow(r.x, 2.0) +
        pow(r.y, 2.0) +
        pow(r.z + 1.0, 2.0)
        );

        vec2 st = r.xy / m + .5;

        vec4 matcapColor = texture(tMatcap, st);


        vec4 coneTracing = voxelTracing(pos + 0.02 * vNormal, r, .01);
    
        float diffuse = max(dot(vNormal, lightDirection), 0.) * (1. - ambientTerm) + ambientTerm;
        float shadowTerm = (ambientTerm + (1. - ambientTerm) * shadows);

        colorData1 = vec4( vec3(0.94) * fresnel + (1. - fresnel) * diffuse * vec3(1. - ao.w) * shadowTerm, uAlpha );
        vec3 color = pow(coneTracing.rgb, vec3(0.4545));
        colorData1.rgb = vec3(pow(1. - ao.w, 0.4545) * color);

        //if(uReady == 0. || true) colorData1.rgb = vNormal;

        float n = 0.01;
        float f = 1000.;
        float d = (2.0 * n) / (f + n - vZ * (f - n));

        d = abs(vMPos.z + length(cameraPosition)) / 20.;
        colorData2 = vec4( vec3(clamp(pow(d, 100.), -1., 1.)), 0. );


        //colorData2 = vec4(1. - 10000. * pow(d, 4.));
    }
`;

export {fsRenderGeometry};