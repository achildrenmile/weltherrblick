/**
 * Shader Pipeline — Post-processing effects for the Cesium scene.
 *
 * Implements 5 visual modes via Cesium PostProcessStage:
 * 1. Standard — no post-processing
 * 2. CRT — scanlines, chromatic aberration, vignette, phosphor glow
 * 3. Night Vision — green monochrome, noise, intensifier bloom
 * 4. FLIR / Thermal — heat gradient LUT, blur, edge enhancement
 * 5. Pixelated / Sat-recon — downsample + sharpen
 *
 * Each shader reads uniform values from the store so sliders take effect in real-time.
 */
import * as Cesium from 'cesium'
import type { ShaderMode, ShaderSettings } from '../store'

// ── GLSL fragment shaders ──

const CRT_FRAG = /* glsl */ `
uniform sampler2D colorTexture;
uniform vec2 colorTextureDimensions;
in vec2 v_textureCoordinates;
uniform float u_intensity;
uniform float u_scanlineDensity;
uniform float u_vignette;
uniform float u_noise;
uniform float u_bloom;
uniform float u_time;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec2 res = colorTextureDimensions;

  // Chromatic aberration
  float aberr = 0.003 * u_intensity;
  float r = texture(colorTexture, uv + vec2(aberr, 0.0)).r;
  float g = texture(colorTexture, uv).g;
  float b = texture(colorTexture, uv - vec2(aberr, 0.0)).b;
  vec3 color = vec3(r, g, b);

  // Scanlines
  float scanline = sin(uv.y * res.y * 3.14159 * u_scanlineDensity * 2.0) * 0.5 + 0.5;
  color *= mix(1.0, scanline, u_intensity * 0.3);

  // Phosphor glow (simple bloom approximation)
  vec3 bloom_color = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      bloom_color += texture(colorTexture, uv + vec2(float(i), float(j)) / res * 3.0).rgb;
    }
  }
  bloom_color /= 25.0;
  color += bloom_color * u_bloom * 0.3;

  // Noise
  float n = rand(uv + u_time) * u_noise * 0.15;
  color += vec3(n);

  // Vignette
  float d = distance(uv, vec2(0.5));
  color *= 1.0 - d * d * u_vignette * 2.0;

  // Green tint for CRT feel
  color *= vec3(0.9, 1.0, 0.9);

  out_FragColor = vec4(color, 1.0);
}
`

const NIGHTVISION_FRAG = /* glsl */ `
uniform sampler2D colorTexture;
uniform vec2 colorTextureDimensions;
in vec2 v_textureCoordinates;
uniform float u_intensity;
uniform float u_noise;
uniform float u_bloom;
uniform float u_vignette;
uniform float u_time;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec2 res = colorTextureDimensions;

  vec3 color = texture(colorTexture, uv).rgb;

  // Convert to luminance
  float lum = dot(color, vec3(0.299, 0.587, 0.114));

  // Intensifier bloom
  vec3 bloom_color = vec3(0.0);
  for (int i = -3; i <= 3; i++) {
    for (int j = -3; j <= 3; j++) {
      vec3 s = texture(colorTexture, uv + vec2(float(i), float(j)) / res * 4.0).rgb;
      bloom_color += s;
    }
  }
  bloom_color /= 49.0;
  float bloom_lum = dot(bloom_color, vec3(0.299, 0.587, 0.114));
  lum = mix(lum, lum + bloom_lum * 0.5, u_bloom);

  // Night vision green
  vec3 nv = vec3(lum * 0.2, lum * 1.0, lum * 0.2) * u_intensity * 2.0;

  // Noise
  float n = rand(uv * res + u_time * 100.0) * u_noise * 0.3;
  nv += vec3(n * 0.2, n, n * 0.2);

  // Vignette (heavier for NV)
  float d = distance(uv, vec2(0.5));
  float vig = 1.0 - d * d * u_vignette * 3.0;
  nv *= vig;

  out_FragColor = vec4(nv, 1.0);
}
`

const FLIR_FRAG = /* glsl */ `
uniform sampler2D colorTexture;
uniform vec2 colorTextureDimensions;
in vec2 v_textureCoordinates;
uniform float u_intensity;
uniform float u_sharpen;
uniform float u_bloom;
uniform float u_vignette;

// Thermal gradient: black → blue → purple → red → orange → yellow → white
vec3 thermalGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.2) return mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.8), t / 0.2);
  if (t < 0.4) return mix(vec3(0.0, 0.0, 0.8), vec3(0.6, 0.0, 0.8), (t - 0.2) / 0.2);
  if (t < 0.6) return mix(vec3(0.6, 0.0, 0.8), vec3(1.0, 0.0, 0.0), (t - 0.4) / 0.2);
  if (t < 0.8) return mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.6, 0.0), (t - 0.6) / 0.2);
  return mix(vec3(1.0, 0.6, 0.0), vec3(1.0, 1.0, 0.8), (t - 0.8) / 0.2);
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec2 res = colorTextureDimensions;
  vec2 texel = 1.0 / res;

  vec3 color = texture(colorTexture, uv).rgb;

  // Edge enhancement via Laplacian
  vec3 laplacian = -4.0 * color;
  laplacian += texture(colorTexture, uv + vec2(texel.x, 0.0)).rgb;
  laplacian += texture(colorTexture, uv - vec2(texel.x, 0.0)).rgb;
  laplacian += texture(colorTexture, uv + vec2(0.0, texel.y)).rgb;
  laplacian += texture(colorTexture, uv - vec2(0.0, texel.y)).rgb;

  color += laplacian * u_sharpen * 0.5;

  // Luminance → thermal LUT
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  lum = pow(lum, 1.0 / (u_intensity + 0.5));
  vec3 thermal = thermalGradient(lum);

  // Soft bloom
  vec3 bloom_color = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      bloom_color += texture(colorTexture, uv + vec2(float(i), float(j)) * texel * 2.0).rgb;
    }
  }
  bloom_color /= 25.0;
  float bl = dot(bloom_color, vec3(0.299, 0.587, 0.114));
  thermal += thermalGradient(bl) * u_bloom * 0.2;

  // Vignette
  float d = distance(uv, vec2(0.5));
  thermal *= 1.0 - d * d * u_vignette * 1.5;

  out_FragColor = vec4(thermal, 1.0);
}
`

const PIXELATED_FRAG = /* glsl */ `
uniform sampler2D colorTexture;
uniform vec2 colorTextureDimensions;
in vec2 v_textureCoordinates;
uniform float u_pixelation;
uniform float u_sharpen;
uniform float u_intensity;
uniform float u_vignette;

void main() {
  vec2 uv = v_textureCoordinates;
  vec2 res = colorTextureDimensions;
  vec2 texel = 1.0 / res;

  // Pixelation
  float pixelSize = max(1.0, u_pixelation * 12.0);
  vec2 pixelUV = floor(uv * res / pixelSize) * pixelSize / res;
  vec3 color = texture(colorTexture, pixelUV).rgb;

  // Sharpening (unsharp mask)
  vec3 blur = vec3(0.0);
  blur += texture(colorTexture, pixelUV + vec2(texel.x, 0.0)).rgb;
  blur += texture(colorTexture, pixelUV - vec2(texel.x, 0.0)).rgb;
  blur += texture(colorTexture, pixelUV + vec2(0.0, texel.y)).rgb;
  blur += texture(colorTexture, pixelUV - vec2(0.0, texel.y)).rgb;
  blur *= 0.25;
  color += (color - blur) * u_sharpen;

  // Slight desaturation for sat-recon look
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(lum), 0.3 * u_intensity);

  // Vignette
  float d = distance(uv, vec2(0.5));
  color *= 1.0 - d * d * u_vignette * 1.5;

  out_FragColor = vec4(color, 1.0);
}
`

// ── Pipeline Manager ──

export class ShaderPipeline {
  private viewer: Cesium.Viewer
  private currentStage: Cesium.PostProcessStage | null = null
  private timeUniform = { value: 0 }

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer
    // Tick time uniform
    this.viewer.scene.preRender.addEventListener(() => {
      this.timeUniform.value = performance.now() / 1000
      if (this.currentStage) {
        try {
          this.currentStage.uniforms.u_time = this.timeUniform.value
        } catch {
          // u_time may not exist on all shaders
        }
      }
    })
  }

  setMode(mode: ShaderMode, settings: ShaderSettings) {
    // Remove existing
    if (this.currentStage) {
      this.viewer.scene.postProcessStages.remove(this.currentStage)
      this.currentStage = null
    }

    if (mode === 'standard') return

    const fragShader = this.getFragmentShader(mode)
    if (!fragShader) return

    const uniforms = this.buildUniforms(mode, settings)

    this.currentStage = new Cesium.PostProcessStage({
      fragmentShader: fragShader,
      uniforms,
    })

    this.viewer.scene.postProcessStages.add(this.currentStage)
  }

  updateSettings(settings: ShaderSettings) {
    if (!this.currentStage) return
    const u = this.currentStage.uniforms
    if ('u_intensity' in u) u.u_intensity = settings.intensity
    if ('u_pixelation' in u) u.u_pixelation = settings.pixelation
    if ('u_noise' in u) u.u_noise = settings.noise
    if ('u_bloom' in u) u.u_bloom = settings.bloom
    if ('u_sharpen' in u) u.u_sharpen = settings.sharpen
    if ('u_vignette' in u) u.u_vignette = settings.vignette
    if ('u_scanlineDensity' in u) u.u_scanlineDensity = settings.scanlineDensity
  }

  private getFragmentShader(mode: ShaderMode): string | null {
    switch (mode) {
      case 'crt': return CRT_FRAG
      case 'nightvision': return NIGHTVISION_FRAG
      case 'flir': return FLIR_FRAG
      case 'pixelated': return PIXELATED_FRAG
      default: return null
    }
  }

  private buildUniforms(mode: ShaderMode, s: ShaderSettings): Record<string, number> {
    const base: Record<string, number> = {
      u_intensity: s.intensity,
      u_vignette: s.vignette,
      u_time: 0,
    }

    switch (mode) {
      case 'crt':
        return { ...base, u_scanlineDensity: s.scanlineDensity, u_noise: s.noise, u_bloom: s.bloom }
      case 'nightvision':
        return { ...base, u_noise: s.noise, u_bloom: s.bloom }
      case 'flir':
        return { ...base, u_sharpen: s.sharpen, u_bloom: s.bloom }
      case 'pixelated':
        return { ...base, u_pixelation: s.pixelation, u_sharpen: s.sharpen }
      default:
        return base
    }
  }

  dispose() {
    if (this.currentStage) {
      this.viewer.scene.postProcessStages.remove(this.currentStage)
      this.currentStage = null
    }
  }
}
