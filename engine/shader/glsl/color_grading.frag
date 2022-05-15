#version 310 es

#extension GL_GOOGLE_include_directive : enable
// #extension GL_EXT_debug_printf      : enable

#include "constants.h"

layout(input_attachment_index = 0, set = 0, binding = 0) uniform highp subpassInput in_color;

layout(set = 0, binding = 1) uniform sampler2D color_grading_lut_texture_sampler;

layout(location = 0) out highp vec4 out_color;

void main()
{
    highp ivec2 lut_tex_size = textureSize(color_grading_lut_texture_sampler, 0);
    highp float N            = float(lut_tex_size.y); // 16x16x16 or 32x32x16

    highp vec4 color         = subpassLoad(in_color).rgba;

    highp float u = (floor(color.b * N) * N + color.r * (N - 1.0)) / (N * N - 1.0);
    highp float v = color.g;

    out_color = texture(color_grading_lut_texture_sampler, vec2(u, v));
    // out_color = color;
}