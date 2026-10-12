# 현재 STV Results 문장·형식 독립 검수

대상: Z:\Hyeokijn_Kwon\Main_project_HJ\STV_meta\논문작성\Article\Strobe meta analysis_Oct 09 2026_HJ.docx

수정 없이 10개 통계 문단을 모두 읽고, 저장된 DOCX와 현재 Word 문단을 대조하였다. 판단은 원고와 HTML 수정 지시가 아니라 검토 의견이다.

## 확인 결과

- 전체효과 → 이질성/Egger → 전체 민감도 → population → outcome → session number → stimulation variability 순서가 Motor/Cognitive에서 대칭이다.
- Moderator variable analyses는 명사 수식으로 문법상 적절하다. variable analyses를 variables analyses로 변경할 필요가 없다.
- 한 통합 추정값을 가리킬 때 effect, 두 하위범주의 추정값을 함께 가리킬 때 effects가 사용되어 있다. significant motor/cognitive improvements의 복수는 변화된 수행을 가리키므로 effect 수의 오류가 아니다.
- for athletes/healthy adults/patients/constant settings/multiple-session protocols는 집단·조건을, on static/dynamic balance/functional/cognitive outcomes는 결과를 가리켜 적절하다.
- 본분석에서 유의·비유의 결과를 but로, 민감도에서 두 결과를 병렬 and로 연결하는 방식은 현재 사용자 선호에 맞고 문법적으로 가능하다.
- No study remained는 남은 연구가 없다는 설명이므로 제거 대상 remained 효과 표현과 다르다.
- 현재 통계 문단의 한자리 연구·비교 수는 모두 영어 단어로 되어 있다. 통계 숫자와 한 자리 counts를 혼동하지 않았다.
- I² 25.3%를 relatively low, 43.7%를 relatively moderate로 대략 기술하는 것은 허용 가능하다. 단일 절대 경계로 과도하게 단정하지 않는다.
- I²/β₀의 I/β 63개는 모두 이탤릭, ²/₀는 모두 비이탤릭 Unicode 위·아래첨자이며 숫자값은 비이탤릭이다.
- 대응된 열 문단의 줄간격은 24pt(Word double), 단락 뒤 간격 0, population 단락 앞 간격 12pt로 일치한다.
- Motor 전체 문단은 tab, Cognitive 전체 문단은 첫 줄 들여쓰기를 사용하지만 문서 기본 tabstop도 40pt이므로 최종 첫 줄 위치는 40pt로 같아 들여쓰기 오류로 판단하지 않았다.
- Z는 전부 정체로 통일되어 있다. 사용자가 P/I/β의 이탤릭을 요청한 범위에서는 Z를 임의로 변경할 근거가 없다.

## 수정/확인할 위치

### S01 · Word 문단 33, 42 · interpretation_major

현재 표현: an Egger’s regression test found a significant publication bias / and significant publication bias / and a significant publication bias

판단: 유의한 Egger 절편으로 출판편향의 존재를 확정한 네 표현이다. 절편의 유의성은 funnel plot 비대칭의 신호이며 출판편향 자체를 입증하지 않는다.

최소 수정안: 본분석의 found a significant publication bias를 showed a significant intercept, suggesting potential funnel plot asymmetry로 바꾸고, 민감도 문장의 significant publication bias를 a significant Egger’s regression intercept로 바꾼다. β₀/P 값은 유지한다.

### S02 · Word 문단 48 · interpretation_clarity

현재 표현: also showed a significant positive effect for constant settings

판단: 고정 설정은 본분석 P = 0.224, 민감도 P = 0.034로 비유의에서 유의로 바뀌었다. also는 문법적으로 추가 보고를 뜻할 수 있지만 앞과 동일한 유의 결과가 반복된 것처럼 읽힐 수 있다.

최소 수정안: also showed를 showed로 최소 변경하고, 필요하면 The effect for constant settings was non-significant in the primary analysis but significant in the sensitivity analysis.를 이어 변화 자체를 밝힌다.

### S03 · Word 문단 33, 36, 37, 38, 39, 42, 45, 46, 47, 48 · format_before_submission

현재 표현: Fig. ) / Fig.)

판단: 본문 Figure 참조 번호가 열 통계 문단에서 모두 비어 있다. Insert Fig. 3/4의 본문 전체효과와 하위집단 Figure 참조 번호는 최종 배치와 대조하여 채워야 한다.

최소 수정안: 확정된 Figure 번호 또는 부록 번호만 넣는다. 서술 순서만 보고 자동 번호를 만들어 넣지 않는다.

### S04 · Word 문단 33 · format_minor

현재 표현: P < 0.001 (motor overall main) / P = 0.002 (motor overall main Egger)

판단: 통계 P 70개 중 이 두 P만 이탤릭이 아니다. 나머지 P 68개와 I 29개, β 34개는 이탤릭이다.

최소 수정안: 이 두 P 문자만 이탤릭으로 맞춘다. 숫자와 문장/용어 전체를 이탤릭으로 만들지 않는다.

### S05 · Word 문단 33, 42 · reporting_consistency

현재 표현: additionally showed significant motor improvements after SVT (SMD = 0.555; ... )

판단: Motor 전체 민감도 괄호에는 남은 51 comparisons from 18 studies가 직접 쓰여 있지 않다. 앞의 59/21에서 8/3을 빼면 추론 가능하므로 값이 틀린 것은 아니나, Cognitive 전체 민감도에서는 21/11을 직접 보고해 영역 간 보고 밀도가 다르다.

최소 수정안: Motor 민감도 괄호 첫머리에 51 comparisons from 18 studies;를 추가하는 것이 대칭적인 보고다.

### S06 · Word 문단 36, 45, 46, 47 · analysis_limit

현재 표현: three comparisons from one study; ... β₀ = 251.060 with P = 0.318

판단: 특히 Cognitive patient는 한 연구의 세 비교에서 나온 Egger 값이다. 계산 가능 여부와 독립 연구 수에 근거한 해석 가능 여부는 다르다. 본문에 값을 표시했더라도 작은 연구 수의 비유의 Egger를 대칭/편향 없음의 입증으로 읽으면 안 된다.

최소 수정안: 결과 숫자는 원표를 유지한다. 방법/한계에 독립 연구 수가 적은 하위집단 및 같은 연구 내 여러 비교에서의 Egger 해석 한계를 설명한다.

### S07 · Word 문단 36 · scope_explanation

현재 표현: no significant effects for healthy adults ... and patients ...

판단: Motor population에서 older adults의 한 비교/한 연구는 전체효과에 포함되지만 이 population 결과 문단에서는 보고되지 않는다. 부모 검수자가 Sep30/Oct07 초안에도 없었음을 확인했으므로 이번 수정으로 삭제된 결과로 보지는 않는다.

최소 수정안: 단일 비교라 하위집단 통합 결과 보고에서 생략한 것인지 설명하거나, 해당 연구의 결과로 별도 서술한다. 의도 확인 없이 자동 복원하지 않는다.

### S08 · Word 문단 33 · grammar_minor

현재 표현: with similar heterogeneity level

판단: 가산명사 level 앞에 관사가 빠져 있다. Cognitive 대응 문장은 with a similar heterogeneity level로 되어 있다.

최소 수정안: with a similar heterogeneity level로 a만 추가한다.

### S09 · Word 문단 33, 36, 37, 38, 39, 42, 45, 46, 47, 48 · optional_readability

현재 표현: The second moderator variable analysis on different outcome measures showed significant positive effects on basic reaction and processing speed ... and anticipation and decision-making ... , but no significant effects on executive function and working memory ... and visuospatial function ...

판단: Cognitive outcome 본분석 한 문장이 168단어, Motor outcome 136단어, Motor population 132단어이며 괄호가 길다. 교수님이 4–5줄을 넘는 경우 두 문장으로 나누어도 된다고 한 피드백을 적용할 검토 대상이다. 길다는 것만으로 문법 오류는 아니다.

최소 수정안: 유의 결과의 마지막 괄호 뒤에서 마침표로 끊고 다음 문장을 However, no significant effects ...로 시작하거나 static 비유의와 dynamic/functional 유의 결과를 두 문장으로 나눈다. 통계 괄호, 인용, 제외 수를 삭제하지 않는다.

### S10 · Word 문단 33, 42 · optional_logic

현재 표현: A heterogeneity level ... was relatively low/moderate ..., whereas an Egger’s regression test ...

판단: I²와 Egger는 다른 질문에 대한 검정이므로 low/moderate와 유의 Egger가 대조 명제는 아니다. whereas가 틀린 문법은 아니지만 관계를 불필요하게 대비시킨다.

최소 수정안: 이질성과 Egger를 별도 문장으로 연결하면 가장 명확하다. 최소 변경하려면 whereas를 and로 바꿀 수 있다.

### S11 · Word 문단 37, 46 · optional_terminology

현재 표현: different outcome measures / the other three outcome measures

판단: 여기에서 보고하는 것은 개별 측정값보다 static/dynamic/functional 또는 cognitive outcome 묶음이다. measures는 교수님 현재 문체라 보존 가능하지만 Table3의 실제 측정변수와 하위분석 범주를 혼동할 여지는 있다.

최소 수정안: 현재 본문을 자동 변경하지 않는다. 필요하면 분석 범주를 가리킬 때 outcome types 또는 outcome categories를 선택하여 Methods/Table3와 통일한다.

## 독립 판단 교차 확인

- all_effect_significance_labels_match_p_and_ci: pass by independent interpretation audit; no label reversal observed
- i2_low_25_3_moderate_43_7: pass approximate descriptive labels
- four_egger_publication_bias_overclaims: agree revise
- cognitive_constant_main_non_significant_sensitivity_significant: agree clarity correction recommended
- few_independent_study_egger_limits: agree calculate does not mean adequate inference
- older_adult_population_absent: agree existing omission/scope explanation, not automatic restoration
- motor_sensitivity_51_18_direct_report_absent: agree reporting consistency issue, not wrong SMD
- motor_main_two_p_not_italic: confirmed native DOCX independently
- indent_visual_mismatch: not an issue; default tabstop 40pt equals other firstline 40pt

## 범위와 한계

통계 Results 10문단 전체를 확인하였다. Word comments/revisions가 0인 것은 현재 사용자가 수락한 상태임이 부모 검수로 확인되어 오류로 보지 않았다. 전체 논문의 Methods·RoB·원문 재추출은 이번 문장 검수의 범위가 아니다. 시각적 페이지 검증은 별도로 부모 에이전트가 수행한다.
