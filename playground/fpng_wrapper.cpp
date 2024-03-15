#include "fpng.h"
#include "fpng_wrapper.h" // You need to create this header file
#include <cstring>

extern "C" {
    void fpng_init_wrapper() {
        fpng::fpng_init();
    }

    bool fpng_encode_image_to_memory_wrapper(const void* pImage, uint32_t w, uint32_t h, uint32_t num_chans, void* out_buf, uint32_t* out_size, uint32_t flags) {
        std::vector<uint8_t> out_buf_vec;
        bool result = fpng::fpng_encode_image_to_memory(pImage, w, h, num_chans, out_buf_vec, flags);
        if (result && out_buf_vec.size() <= *out_size) {
            memcpy(out_buf, out_buf_vec.data(), out_buf_vec.size());
            *out_size = out_buf_vec.size();
        } else {
            result = false;
        }
        return result;
    }
}
