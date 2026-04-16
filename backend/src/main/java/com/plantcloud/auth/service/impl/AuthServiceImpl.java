package com.plantcloud.auth.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.plantcloud.auth.ai.SmartFaceAiClient;
import com.plantcloud.auth.dto.FaceLoginRequest;
import com.plantcloud.auth.dto.FaceRegisterRequest;
import com.plantcloud.auth.dto.LoginRequest;
import com.plantcloud.auth.service.AuthService;
import com.plantcloud.auth.vo.LoginVO;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.security.jwt.JwtTokenUtil;
import com.plantcloud.system.exception.BizException;
import com.plantcloud.user.entity.User;
import com.plantcloud.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenUtil jwtTokenUtil;
    private final SmartFaceAiClient smartFaceAiClient;

    @Override
    public LoginVO login(LoginRequest request) {
        User user = findByUsername(request.getUsername());
        if (user == null || !passwordMatches(request.getPassword(), user.getPasswordHash())) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "Invalid username or password");
        }
        return buildLoginVO(user);
    }

    @Override
    public void registerFace(FaceRegisterRequest request) {
        validateFaceImage(request.getFaceImage());

        User user = findByUsername(request.getUsername());
        if (user == null) {
            user = createUser(request.getUsername(), request.getPassword());
        } else if (!passwordMatches(request.getPassword(), user.getPasswordHash())) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "Username already exists and password is incorrect");
        }

        smartFaceAiClient.register(user, request.getFaceImage());
        user.setFaceImage(request.getFaceImage());
        userMapper.updateById(user);
    }

    @Override
    public LoginVO faceLogin(FaceLoginRequest request) {
        validateFaceImage(request.getFaceImage());

        SmartFaceAiClient.FaceMatch match = smartFaceAiClient.search(request.getFaceImage());
        User user = userMapper.selectById(match.userId());
        if (user == null) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "Face matched an unknown user");
        }

        return buildLoginVO(user);
    }

    private User findByUsername(String username) {
        LambdaQueryWrapper<User> query = new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username);
        return userMapper.selectOne(query);
    }

    private User createUser(String username, String password) {
        User user = new User();
        user.setUsername(username);
        user.setNickname(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole("USER");
        user.setStatus("1");
        userMapper.insert(user);
        return user;
    }

    private boolean passwordMatches(String rawPassword, String passwordHash) {
        if (rawPassword == null || passwordHash == null) {
            return false;
        }
        return passwordEncoder.matches(rawPassword, passwordHash) || passwordHash.equals(rawPassword);
    }

    private LoginVO buildLoginVO(User user) {
        String token = jwtTokenUtil.generateAccessToken(user.getId(), user.getUsername(), user.getRole());
        return LoginVO.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .role(user.getRole())
                .accessToken(token)
                .refreshToken("")
                .build();
    }

    private void validateFaceImage(String faceImage) {
        if (faceImage == null || faceImage.isBlank()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Face image is required");
        }
        if (!faceImage.startsWith("data:image/jpeg;base64,")
                && !faceImage.startsWith("data:image/png;base64,")) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Invalid face image format");
        }
    }
}
