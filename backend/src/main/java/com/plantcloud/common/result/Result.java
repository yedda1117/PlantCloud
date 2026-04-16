package com.plantcloud.common.result;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {

    private Integer code;
    private String message;
    private T data;
    private Long timestamp;

    public static <T> Result<T> ok(T data) {
        Result<T> result = new Result<T>();
        result.setCode(0);
        result.setMessage("success");
        result.setData(data);
        result.setTimestamp(System.currentTimeMillis());
        return result;
    }

    public static <T> Result<T> fail(Integer code, String message) {
        Result<T> result = new Result<T>();
        result.setCode(code);
        result.setMessage(message);
        result.setTimestamp(System.currentTimeMillis());
        return result;
    }

    // Builder pattern implementation
    public static <T> Builder<T> builder() {
        return new Builder<T>();
    }

    public static class Builder<T> {
        private Integer code;
        private String message;
        private T data;
        private Long timestamp;

        public Builder<T> code(Integer code) {
            this.code = code;
            return this;
        }

        public Builder<T> message(String message) {
            this.message = message;
            return this;
        }

        public Builder<T> data(T data) {
            this.data = data;
            return this;
        }

        public Builder<T> timestamp(Long timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public Result<T> build() {
            Result<T> result = new Result<T>();
            result.setCode(code);
            result.setMessage(message);
            result.setData(data);
            result.setTimestamp(timestamp);
            return result;
        }
    }
}
