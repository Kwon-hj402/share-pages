# 프로젝트 구현 근거 목록

확인일: 2026-10-29  
경로 기준: `C:/Users/user/miniconda3/envs/yun/`

| 구분 | 자료 및 경로 | 확인 항목 |
|---|---|---|
| 촬영·추적 설정 | `model/config/detector_config.local.json` | 8대 카메라, 22개 마커 ID, 영상 오프셋 및 추적 설정 |
| 내부 보정 | `model/calibration/intrinsics/camera1..8_intrinsics.yaml` | 카메라 행렬, 렌즈 왜곡 계수 |
| 외부 보정 | `model/calibration/extrinsics/multicam_extrinsics.yaml` | 카메라 간 강체 변환, 카메라 1 기준 좌표계 |
| 보정 원본 | `8.20_data/experiment_video/calibration_results/` | AprilGrid, moving-board, floor-PnP 및 SE(3) 결합 기록 |
| Markerless 실행 | `july/intrinsic_cali_7.30/extrinsic/run_extrinsic_yolo_3d_html.py` | 6대 카메라·YOLO11m-pose·8개 take |
| Markerless 복원 | `july/first_in_extrinsic_cali/extrinsic cali/reconstruct_gait_3d.py` | 2D 대응, weighted DLT, 관측 선별, 보간·평활화 |
| Markerless 결과 | `july/intrinsic_cali_7.30/extrinsic/yolo_3d_results/` | 2D/3D 좌표, 시행별 로그, 전신 동영상 |
| 내부 품질 평가 | `july/intrinsic_cali_7.30/extrinsic/best_marker_segments/validation/` | 선별 구간의 복원률, 재투영 오차, 분절 길이 robust CV |
| 마커 학습·검수 | `model/`의 학습 설정·로그 및 승인 주석 | YOLO11s 검출기, 해부학적 ID·정적 보조 모델 |
| 광학식 기준 비교 | `model/exports/YGT_gait1_mocap_mpjpe_20260920/report_ko.md` | 21개 공통 마커, 관측쌍별 위치 오차, 시간·강체 정합 |

## 세부 자료

- `content.json`: 기술자료의 본문·표·설명·출처
- `project2-evidence.json`: Project 2 항목별 구현 파일·결과 경로
- `mocap-summary.json`: 단일 보행 시행의 예비 비교 집계
- `sources.json`: 문헌 서지정보와 연구 조건
- `media-manifest.json`: 수록 그림·영상의 원본 및 처리 내역

## 평가 범위

- 카메라 보정·다중 시점 3D 복원, 전신 자세 추정 기준선 및 표면 마커 추적의 구현 자료
- 마커 검출기의 내부 검증 및 단일 보행 시행의 광학식 기준 좌표 비교
- 후속 검증: 통합 Hybrid 추정기, 독립 대상자·세션, 관절각·분절 회전 및 동작별 일치도
