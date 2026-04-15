package com.plantcloud.photo.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.photo.service.PhotoService;
import com.plantcloud.photo.vo.PhotoLogVO;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/photos")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photoService;

    @Operation(summary = "上传每日植物图片")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<PhotoLogVO> upload(@RequestParam Long plantId,
                                     @RequestParam Long userId,
                                     @RequestPart("file") MultipartFile file) {
        return Result.ok(photoService.upload(plantId, file, userId));
    }

    @GetMapping
    public Result<List<PhotoLogVO>> list(@RequestParam Long plantId) {
        return Result.ok(photoService.list(plantId));
    }

    @GetMapping("/{date}")
    public Result<PhotoLogVO> getByDate(@RequestParam Long plantId,
                                        @PathVariable @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date) {
        return Result.ok(photoService.getByDate(plantId, date));
    }
}
