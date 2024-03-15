#pragma once
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void fpng_init_wrapper();

bool fpng_encode_image_to_memory_wrapper(const void* pImage, uint32_t w, uint32_t h, uint32_t num_chans, void* out_buf, uint32_t* out_size, uint32_t flags);

#ifdef __cplusplus
}
#endif
