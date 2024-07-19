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
    in vec3 vNormal2;
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
        sca *= 0.96;
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




    const float MAX_DISTANCE = 1.;
    const float MAX_ALPHA = 0.95;
    float voxelWorldSize = 1. / 128.;

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

    vec4 getIndirectLighting(vec3 startPos, vec3 normal, float aperture, float rotation) {

      vec3 uvw = startPos;

      float ang0 = radians(rotation);
      float s = sin(ang0);
      float c = cos(ang0);

      vec3 dir1 = vec3(0., 0., 1.);
      vec3 dir2 = vec3( s, 0., c);
      vec3 dir3 = vec3(-s, 0., c);
      vec3 dir4 = vec3(0., s, c);
      vec3 dir5 = vec3(0.,-s, c);

      vec3 zAxis = normalize(vNormal);
      vec3 xAxis = vec3(1., 0., 0.);
      vec3 yAxis = vec3(0., 1., 0.);
      vec3 UP = vec3(0., 1., 0.);
      mat3 rot = mat3(0.);

      if((dot(UP, vNormal)) > 0.99 || true) {
          xAxis = normalize(cross(UP, zAxis));
          yAxis = normalize(cross(zAxis, xAxis));  
          rot = mat3(xAxis, yAxis, zAxis);
      
      } else {
          zAxis = vec3(0., 0., 1.);
          rot = mat3(xAxis, zAxis, yAxis);
      }

      dir1 = rot * dir1;
      dir2 = rot * dir2;
      dir3 = rot * dir3;
      dir4 = rot * dir4;
      dir5 = rot * dir5;

      vec4 cone1 = voxelTracing(uvw, dir1, aperture);    
      vec4 cone2 = voxelTracing(uvw, dir2, aperture);    
      vec4 cone3 = voxelTracing(uvw, dir3, aperture);    
      vec4 cone4 = voxelTracing(uvw, dir4, aperture);    
      vec4 cone5 = voxelTracing(uvw, dir5, aperture);    

      return (cone1 + cone2 + cone3 + cone4 + cone5) / 5.;
  }


    float fresnel(vec3 incom, vec3 normal, float index_internal, float index_external) {
        float eta = index_internal / index_external;
        float cos_theta1 = dot(incom, normal);
        float cos_theta2 = 1.0 - (eta * eta) * (1.0 - cos_theta1 * cos_theta1);

        if (cos_theta2 < 0.0) {
              return 1.0;
          } else {
          cos_theta2 = sqrt(cos_theta2);
          float fresnel_rs = (index_internal * cos_theta1 - index_external * cos_theta2) / (index_internal * cos_theta1 + index_external * cos_theta2);
          float fresnel_rp = (index_internal * cos_theta2 - index_external * cos_theta1) / (index_internal * cos_theta2 + index_external * cos_theta1);
          return (fresnel_rs * fresnel_rs + fresnel_rp * fresnel_rp) * 0.5;
        }
    }

    void main() {

        //Ambient occlusion
        vec3 pos = (vPos - sceneData.rgb) / sceneData.a;
        vec4 ao = getAmbientOcclusion(pos + 0.01 * vNormal, vNormal);
        float ambientOcclusion = 1. - ao.w;

        vec3 baseColor = vColor.rgb / 255.;

        float n1 = 1.5;
        float n2 = 1.;
        float R0 = (n1 - n2) / (n1 + n2);
        R0 *= R0;
        float NdV = max(dot(vec3(1., 0., 0.), vNormal), 0.);
        NdV = pow(NdV, 5.);
        float fresnel = R0 + (1. - R0) * NdV;

        vec3 eye = -normalize(cameraPosition - vPos);
        vec3 reflectRay = reflect(eye, vNormal2);


        vec3 lightPosition = vec3(0., 1000., 0.);
        vec3 lightDirection = normalize(lightPosition - vPos);
        vec3 reflectLight = reflect(lightDirection, vNormal2);

        float diffuse = max(dot(vNormal2, lightDirection), 0.);
        float specular = pow(max(dot(eye, reflectLight), 0.), 10.);

        float lighting = diffuse * 0.3 + 0.3 * specular + 0.4;

        vec4 indirectLighting = getIndirectLighting(pos + 0.03 * vNormal2, vNormal2, 1., 45.);

        baseColor *= lighting;
        baseColor += indirectLighting.rgb;

        vec3 e = normalize(vMPos);
        vec3 r = reflect(e, vNormal);
        float m = 2.0 * sqrt(pow(r.x, 2.0) + pow(r.y, 2.0) + pow(r.z + 1.0, 2.0));
        vec2 st = r.xy / m + .5;
        vec4 matcap = texture(tMatcap, st);

        baseColor = (1. - ao.w) * mix(vec3(0.94), baseColor, vec3(1. - fresnel));

        colorData1 = vec4(pow(baseColor, vec3(0.4545)), 1.);


        float d = 1.;
        colorData2 = vec4(d);
    
    }
`;

export {fsRenderGeometry};