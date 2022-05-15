#version 310 es

#extension GL_GOOGLE_include_directive : enable

#include "constants.h"
#include "gbuffer.h"


struct DirectionalLight
{
    highp vec3 direction;
    highp float _padding_direction;
    highp vec3 color;
    highp float _padding_color;
};

struct PointLight
{
    highp vec3  position;
    highp float radius;
    highp vec3  intensity;
    highp float  _padding_intensity;
};

layout(set = 0, binding = 2) readonly buffer _mesh_per_frame
{
    highp mat4       proj_view_matrix;
    highp vec3       camera_position;
    highp float       _padding_camera_position;
    highp vec3       ambient_light;
    highp float       _padding_ambient_light;
    highp uint       point_light_num;
    uint             _padding_point_light_num_1;
    uint             _padding_point_light_num_2;
    uint             _padding_point_light_num_3;
    PointLight       scene_point_lights[m_max_point_light_count];
    DirectionalLight scene_directional_light;
    highp mat4       directional_light_proj_view;

    highp vec4       time;
    highp vec4       screen_resolution;
    highp vec4       editor_screen_resolution;
};


layout(input_attachment_index = 0, set = 0, binding = 0) uniform highp subpassInput in_color;

layout(set = 0, binding = 0) uniform sampler2D input_texture_sampler;
// layout(set = 0, binding = 1) uniform sampler2D color_grading_infinite_tsukuyomi_texture_sampler;

/* in_texcoord 范围：左上至右下 (0, 0) ~ (1, 1) */
layout(location = 0) in  highp vec2 in_texcoord;
layout(location = 0) out highp vec4 out_color;

highp vec2 MappingUV2Viewport(highp vec2 full_screen_uv);

#include "mesh_lighting.h"

void main()
{
    // Tweakable parameters 可调参数
    highp float frequency        = 30.0;
    highp float waveSpeed        = 5.0;
    highp float waveStrength     = 0.025; // default 0.2
    highp float waveRadius       = 0.2;
    highp float waveEllipticity  = 1.5; // 椭圆率系数
    highp float sunlightStrength = 5.0;
    highp vec4  sunlightColor    = vec4(1.0, 0.91, 0.75, 1.0);
	highp vec2  centerCoord      = vec2(0.75, 0.1);

	// highp float aspectRatio   = screen_resolution.x / screen_resolution.y;
    // ivec2 texSize = textureSize(input_texture_sampler, 0); // texSize: 1280x766.5882 ?

    /*
    // editor_screen_resolution = { x: 0   , y:   0, z: 1280, w: 720 }
    // screen_resolution        = { x: 1280, y: 768, z:    0, w:   0 }
    highp vec2 editor_ratio = editor_screen_resolution.zw / screen_resolution.xy;
                            = (1280, 720) / (1280, 768)
                            = (1.0, 0.9375)
    highp vec2 offset       = editor_screen_resolution.xy / screen_resolution.xy;
                            = (0, 0)
    highp vec2 viewport_uv  = full_screen_uv.xy * editor_ratio + offset.xy;
    */

    /* uv_in_viewport 范围: x (0.22745 ~ 0.7490)
     * 如果使用 in_texcoord 进行采样，则会把四周的黑色区域误作为游戏画面显示出来，
     * 导致真正的游戏画面被大幅缩小 & 变形
     */
    highp vec2 uv_in_viewport = MappingUV2Viewport(in_texcoord.xy);
    highp vec2  distVec       = uv_in_viewport - MappingUV2Viewport(centerCoord);
	           distVec.x    /= waveEllipticity; // 椭圆率系数

    // if (waveSpeed > 0.0) {
	//     out_color = texture(input_texture_sampler, in_texcoord);
    //     return;
    // }

    highp float distance      = length(distVec) / waveRadius; // length: 0.0 ~ 1.0
    highp float iTime         = time.x;

	highp float multiplier    = distance < 1.0
                        ? ((distance-1.0)*(distance-1.0)) : 0.0;

	highp float modifiedTime  = iTime * waveSpeed;
	highp float addend        = ( sin(frequency*distance-modifiedTime) + 1.0)
                        * waveStrength
                        * multiplier;

	highp vec2 newTexCoord    = uv_in_viewport + addend;
    // if (newTexCoord.x > -0.7) {
    //     //  newTexCoord.x    = 0.7;
    //     ivec2 texSize = textureSize(input_texture_sampler, 0); // texSize: 1280x766.5882
    //     // highp vec2 rg = vec2(texSize.x, texSize.y) / vec2(1920.0, 1080.0);
    //     // out_color = vec4(rg, 0, 1.0);
    //     out_color = vec4(uv_in_viewport.x/2.0, uv_in_viewport.y/2.0, 0, 1.0);
    //     return;
    // }

	highp vec4 colorToAdd     = sunlightColor * sunlightStrength * addend;
	// highp vec4 colorToAdd     = vec4(0, addend, 0, 1.0); // Almost pure black

	// out_color = texture(input_texture_sampler, newTexCoord) + colorToAdd;

    // highp vec4 prevColor = texture(input_texture_sampler, uv_in_viewport);
    // if (waveRadius > 0.0) {
    //     return;
    // }

    // highp vec4 prevColor = texture(input_texture_sampler, newTexCoord * 0.9);

    /* 当前采样到的 pixel 超出实际 viewport 范围时，左移一个 pixel 进行采样 */
    highp float max_x = 958.0 - 2.0;
    if (newTexCoord.x * 1280.0 > max_x) {
        newTexCoord.x = max_x / 1280.0;
    }
    out_color = texture(input_texture_sampler, newTexCoord) + colorToAdd;

    // if (prevColor.r > 0.01 && prevColor.a > 0.01) {
	//     out_color = vec4(prevColor.rgb, 1.0);
    // }
    // else {
    //     out_color = vec4(0, newTexCoord.x/2.0, 0, 0.3);
    // }

    // 在 GL01 中，将 ripple 参数设置到完全没有变形，然后看最右端的 newTexCoord.x 是多少?
    // 在当前 blur.frag 中，将 ripple 参数设置到右侧完全没有变形（比如 centerCoord 左移），
    // 然后看最右端的 newTexCoord.x 是多少?
    // out_color = vec4(uv_in_viewport.x, uv_in_viewport.x/2.0, 0, 1.0);
}

highp vec2 MappingUV2Viewport(highp vec2 full_screen_uv)
{
    // editor_screen_resolution = { x: 0   , y:   0, z: 1280, w: 720 }
    // screen_resolution        = { x: 1280, y: 768, z:    0, w:   0 }
    highp vec2 editor_ratio = editor_screen_resolution.zw / screen_resolution.xy;
    highp vec2 offset       = editor_screen_resolution.xy / screen_resolution.xy;
    highp vec2 viewport_uv  = full_screen_uv.xy * editor_ratio + offset.xy;

    return viewport_uv;
}
