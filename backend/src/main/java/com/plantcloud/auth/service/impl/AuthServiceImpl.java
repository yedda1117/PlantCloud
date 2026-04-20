import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenUtil jwtTokenUtil;

    @Override
    public LoginVO login(LoginRequest request) {
        LambdaQueryWrapper<User> query = new LambdaQueryWrapper<>()
                .eq(User::getUsername, request.getUsername());

        User user = userMapper.selectOne(query);
        if (user == null) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
        }

        String passwordHash = user.getPasswordHash();
        boolean passwordMatches = passwordHash != null && passwordEncoder.matches(request.getPassword(), passwordHash);
        if (!passwordMatches) {
            // 降级兼容：当 password_hash 直接保存明文时，允许明文比对
            passwordMatches = passwordHash != null && passwordHash.equals(request.getPassword());
        }
        if (!passwordMatches) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
        }

        String token = jwtTokenUtil.generateAccessToken(user.getId(), user.getUsername(), user.getRole());

        return LoginVO.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .role(user.getRole())
                .accessToken(token)
                .refreshToken("")
                .build();
    }

    @Override
    public void registerFace(FaceRegisterRequest request) {
        // 先验证用户名密码
        LambdaQueryWrapper<User> query = new LambdaQueryWrapper<>()
                .eq(User::getUsername, request.getUsername());

        User user = userMapper.selectOne(query);
        if (user == null) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
        }

        String passwordHash = user.getPasswordHash();
        boolean passwordMatches = passwordHash != null && passwordEncoder.matches(request.getPassword(), passwordHash);
        if (!passwordMatches) {
            passwordMatches = passwordHash != null && passwordHash.equals(request.getPassword());
        }
        if (!passwordMatches) {
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
        }

        // 更新人脸图片
        user.setFaceImage(request.getFaceImage());
        userMapper.updateById(user);
    }

    @Override
    public LoginVO faceLogin(FaceLoginRequest request) {
        if (request.getFaceImage() == null || request.getFaceImage().isBlank()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "人脸数据不能为空");
        }

        // 简单实现：遍历所有用户，比较人脸图片（实际应使用 AI 模型）
        // 这里使用简单的字符串比较作为占位，实际应计算相似度
        LambdaQueryWrapper<User> query = new LambdaQueryWrapper<>();
        List<User> users = userMapper.selectList(query);

        for (User user : users) {
            if (user.getFaceImage() != null && user.getFaceImage().equals(request.getFaceImage())) {
                String token = jwtTokenUtil.generateAccessToken(user.getId(), user.getUsername(), user.getRole());
                return LoginVO.builder()
                        .userId(user.getId())
                        .username(user.getUsername())
                        .role(user.getRole())
                        .accessToken(token)
                        .refreshToken("")
                        .build();
            }
        }

        throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "人脸识别失败，未找到匹配用户");
    }
}
