package com.plantcloud.photo.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.photo.service.PhotoService;
import com.plantcloud.photo.vo.PhotoLogVO;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

@RestController
@RequestMapping("/photos")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photoService;

    @Operation(summary = "Upload or replace daily photo")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<PhotoLogVO> upload(@RequestParam("plant_id") Long plantId,
                                     @RequestParam("date")
                                     @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date,
                                     @RequestPart("photo") MultipartFile photo,
                                     @RequestParam(value = "note", required = false) String note,
                                     @RequestParam(value = "milestone", required = false) String milestone) {
        return Result.ok(photoService.upload(plantId, date, photo, note, milestone));
    }

    @DeleteMapping("/{date}")
    public Result<Void> deletePhoto(@PathVariable @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date,
                                    @RequestParam("plant_id") Long plantId) {
        photoService.deletePhoto(plantId, date);
        return Result.ok(null);
    }
}
