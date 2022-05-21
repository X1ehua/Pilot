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

layout(set = 0, binding = 0) uniform sampler2D input_texture_sampler;

layout(set = 0, binding = 1) readonly buffer _mesh_per_frame
{
    highp mat4       proj_view_matrix;
    highp vec3       camera_position;
    highp float      time;
//  highp float       _padding_camera_position;

    highp vec3       ambient_light;
    highp float      _padding_ambient_light;

    highp uint       point_light_num;
    uint             _padding_point_light_num_1;
    uint             _padding_point_light_num_2;
    uint             _padding_point_light_num_3;

    PointLight       scene_point_lights[m_max_point_light_count];
    DirectionalLight scene_directional_light;
    highp mat4       directional_light_proj_view;

    highp vec4       screen_resolution;
    highp vec4       editor_screen_resolution;
};

/* Not used.
 * 疑问：在 blur.frag 中，此 in_color 与 sampler2D input_texture_sampler 为何都使用 binding 0 ?
 */
// layout(input_attachment_index = 0, set = 0, binding = 0) uniform highp subpassInput in_color;

/* in_texcoord 范围：左上至右下 (0, 0) ~ (1, 1) */
layout(location = 0) in  highp vec2 in_texcoord;
layout(location = 0) out highp vec4 out_color;

highp vec2 MappingUV2Viewport(highp vec2 full_screen_uv);

#include "mesh_lighting.h"

void main()
{
    // Tweakable parameters 可微调的参数
    highp float frequency        = 30.0;
    highp float waveSpeed        = 5.0;
    highp float waveStrength     = 0.025; // default 0.2
    highp float waveRadius       = 0.2;
    highp float waveEllipticity  = 1.5;   // 椭圆率系数
    highp float sunlightStrength = 5.0;
    highp vec4  sunlightColor    = vec4(1.0, 0.91, 0.75, 1.0);
	highp vec2  centerCoord      = vec2(0.75, 0.1);

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

    /* uv_in_viewport.x 范围: 0.22745 ~ 0.7490
     * in_texcoord.x 范围：0 ~ 1.0，其中只有 uv_in_viewport 的范围内才是游戏画面。
     * 所以，若不转化为 uv_in_viewport 而直接使用 in_texcoord 进行采样，则会把四周
     * 的黑色区域误作为游戏画面显示出来，导致真正的游戏画面被大幅缩小 & 变形
     */
    highp vec2 uv_in_viewport = MappingUV2Viewport(in_texcoord.xy);

    // if (waveSpeed > 0.0) {
    //     out_color = texture(input_texture_sampler, uv_in_viewport);
    //     return;
    // }

    highp vec2 distanceVec    = uv_in_viewport - MappingUV2Viewport(centerCoord);
	           distanceVec.x /= waveEllipticity; // 椭圆率系数

    highp float distance      = length(distanceVec) / waveRadius; // length() 返回值范围 0.0 ~ 1.0
	highp float multiplier    = distance < 1.0 ? ((distance - 1.0) * (distance - 1.0)) : 0.0;
	highp float modifiedTime  = time * waveSpeed;
	highp float addend        = ( sin(frequency * distance - modifiedTime) + 1.0 )
                              * waveStrength
                              * multiplier;

	highp vec2 newTexCoord    = uv_in_viewport + addend;
	highp vec4 colorToAdd     = sunlightColor * sunlightStrength * addend;

    /* 当前采样到的 pixel 超出实际 viewport 范围时，左移一个 pixel 进行采样。否则会出现异常的纯黑色块 */
    highp float max_x = 958.0 - 2.0; // Hard-code: 游戏画面 x 在 PilotEditor 中的范围: 291~958
    if (newTexCoord.x * 1280.0 > max_x)
    {
        newTexCoord.x = max_x / 1280.0;
    }
    out_color = texture(input_texture_sampler, newTexCoord) + colorToAdd;
}

highp vec2 MappingUV2Viewport(highp vec2 full_screen_uv)
{
    // editor_screen_resolution : { x: 0   , y:   0, z: 1280, w: 720 }
    // screen_resolution        : { x: 1280, y: 768, z:    0, w:   0 }
    highp vec2 editor_ratio = editor_screen_resolution.zw / screen_resolution.xy;
    highp vec2 offset       = editor_screen_resolution.xy / screen_resolution.xy;
    highp vec2 viewport_uv  = full_screen_uv.xy * editor_ratio + offset.xy;

    return viewport_uv;
}
