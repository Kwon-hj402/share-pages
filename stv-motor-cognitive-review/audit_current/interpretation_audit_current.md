# 현재 원고의 통계 해석 독립 검수

검토 문서: Z:\Hyeokijn_Kwon\Main_project_HJ\STV_meta\논문작성\Article\Strobe meta analysis_Oct 09 2026_HJ.docx

현재 본문에 보고된 통합효과 36개는 유의/비유의 문구, P값, 95% CI의 0 포함 여부가 모두 일치한다. 유의한 양의 효과로 보고한 결과도 모두 양의 SMD와 0보다 큰 CI 하한을 가진다. 이 결과는 서술과 제시 통계의 일치 여부를 뜻하며 분석 모형의 타당성까지 확정하는 것은 아니다.

## I01. Egger 유의성을 확정된 출판편향으로 표현한 네 곳

본 분석과 민감도 분석의 Egger P값은 모두 .05 미만으로 유의하지만, 유의한 Egger 절편만으로 출판편향의 존재가 확정되지는 않는다. 현재 두 전체효과 문단에 있는 found a significant publication bias 및 sensitivity significant publication bias 총 네 표현이 과도하다.

근거: [Cochrane Handbook](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-13)

최소 표현 교정:

- `an Egger’s regression test found a significant publication bias` → `an Egger’s regression test showed a significant intercept, suggesting potential funnel plot asymmetry`
- `and significant publication bias` → `and a significant Egger’s regression intercept`
- `and a significant publication bias` → `and a significant Egger’s regression intercept`

## I02. 인지 고정 설정의 유의성이 민감도 분석에서 변경됨

본 분석 SMD=.161, CI −.098~.420, P=.224는 비유의이고 민감도 SMD=.240, CI .018~.462, P=.034는 유의하다. also showed는 추가 결과라는 문법 해석이 가능하여 수치적으로 거짓은 아니지만, 다른 문단처럼 같은 결론이 유지된 것으로 읽힐 수 있다. 효과 방향은 둘 다 양수이나 통계적 유의성은 달라진다. 이 변화가 강건함이나 설정 간 차이를 증명하지도 않는다.

최소 수정 제안:
Sensitivity analyses after excluding two comparisons from one study with a high overall risk of bias (Braly, 2020) showed a significant positive effect for constant settings, which was not significant in the primary analysis (nine comparisons from four studies; SMD = 0.240; 95% CI = 0.018 to 0.462; P = 0.034; I² = 2.2%; β₀ = 2.648 with P = 0.059 from Egger’s regression test).

## I03. 운동 population에서 고령자 한 연구 결과가 미기재

현재 운동 population 본문에 나온 비교 수는 41+3+14=58이며 전체 운동 분석은 59이다. 원표 및 이전 결과의 고령자 한 비교/한 연구(SMD −.375, P=.409)가 설명에서 빠져 있다. 현재 문단은 고령자를 의도적으로 보고에서 제외했는지 설명하지 않는다. 제외후 Chen (2021)의 고령자 자료가 남지 않는다는 설명도 없다. 수치 검수 담당자와 독립적으로 동일한 누락을 확인했다.

삭제 원인이나 의도는 미확인이다. 단일 비교를 통합값처럼 보고하지 않기 위한 선택이었다면 보고 범위를 설명하며 원본에 자동 복원하지 않는다. 아래 문장은 별도 연구 결과로 보고하기로 선택할 때의 제안이다.

최소 추가 제안:
The single study involving older adults showed no significant effect (one comparison from one study; SMD = −0.375; SE = 0.454; 95% CI = −1.265 to 0.515; Z = −0.826; P = 0.409). No older-adult study remained after excluding the study with a high overall risk of bias (Chen, 2021).

## I04. β₀ 계산 가능성과 출판편향 해석 가능성은 별개

≥3 comparisons는 계산값이 나오는 조건이지 신뢰할 수 있는 출판편향 검정 기준이 아니다. Cochrane은 funnel 비대칭 검정을 통상 ≥10 studies에서 사용하고, 유사한 표준오차에서는 사용하지 않으며, SMD에 대한 원래 Egger 검정은 효과크기와 표준오차의 인공상관 문제 때문에 권고하지 않는다. 이 SMD 한계는 소수 연구 하위집단뿐 아니라 전체 분석에도 적용된다. Motor 건강한 성인 3연구/3비교 β₀=10.609,P=.239는 원표 값과 일치한다. Cognitive 환자 1연구/3비교 β₀=251.060,P=.318도 원표 값과 일치하지만 한 연구 내 비교만으로 연구 간 작은 연구 효과를 판단할 수 없다. 유의하지 않은 P값이나 β의 크기는 편향 부재/크기의 증명이 아니다. 값을 보존하더라도 계산값과 탐색적 해석의 한계를 구분해야 한다.

근거: [Cochrane Handbook](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-13)

## I05. 동일 연구의 여러 비교에 대한 종속성 처리 확인 필요

59비교/21연구,23비교/12연구처럼 한 연구가 여러 효과를 제공한다. 같은 참여자·대조군·측정 결과를 공유하는 효과를 독립 효과로 처리하면 통합 SE·CI·P 및 Egger의 유효성이 달라질 수 있다. 현재 DOCX에는 Methods가 없으므로 연구별 결합, 다층모형, robust variance 등 실제 처리 여부를 확인할 수 없다. 단순 random-effects 모형이라는 명칭만으로 종속성 처리가 증명되지 않는다. 따라서 수치/서술 일치 검수는 통과해도 분석 타당성까지 확정 통과라고 하면 안 된다.

근거: [Cochrane Handbook](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-03)

## I06. 운동 하위분석에 반복된 8비교/3연구 제외는 전체 영역의 수

현재 after excluding eight comparisons from three studies는 전체 운동 자료에서의 제외를 가리키면 맞다. 각 하위범주에서 8비교/3연구씩 빠졌다는 의미로 읽으면 맞지 않는다. 따라서 오기재로 단정하지 않고 전체 운동 자료라는 범위를 명확히 하거나 실제 하위범주별 제외 수를 별도로 표시하는 것이 낫다. Population 누락된 고령자까지 포함하면 선수1비교/1연구,환자6비교/1연구,고령자1비교/1연구로 합계8/3이 된다. 연구 수는 서로 다른 하위범주 간 중복될 수 있으므로 단순 합산을 보편 규칙으로 사용하면 안 된다.

최소 수정 제안:
Sensitivity analyses of the motor data after excluding eight comparisons from three studies with a high overall risk of bias ...

## I07. 운동 전체 민감도 분석의 남은 비교·연구 수 미기재

인지 전체 민감도는 21 comparisons from 11 studies를 보고하지만 운동 전체 민감도에는 51 comparisons from 18 studies가 없다. 수치가 틀린 것은 아니며 대칭적 보고를 위해 추가 가능하다.

최소 수정 제안:
additionally showed significant motor improvements after SVT (51 comparisons from 18 studies; SMD = 0.555; ...)

## I08. 전체 I² 수준 및 similar 표현은 타당

Motor I²25.3%를 relatively low, Cognitive43.7%를 relatively moderate로 쓰는 것은 대략적 기준에서 합리적이다. Motor25.3→24.8, Cognitive43.7→42.2는 similar라는 기술적 표현에도 무리가 없다. I²의 범위는 겹치며 절대 경계가 아니고, heterogeneity가 적다는 것만으로 효과가 확실하거나 편향이 없다는 뜻은 아니다.

근거: [Cochrane Handbook](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-10)

## I09. 하위범주별 유의/비유의는 맞고 범주 간 차이는 아직 주장하지 않음

현재 문장은 유의한 범주와 비유의한 범주를 but/and로 기술하며 범주 간 효과가 유의하게 다르다고 직접 주장하지 않는다. 이 수준의 서술은 가능하다. 그러나 이후 논의에서 다회세션이 단일세션보다 우월하거나 변동 설정이 고정 설정보다 효과적이라는 결론을 내리려면 해당 범주 간 공식 차이 검정이 필요하다. 현재 본문만으로 그 검정 수행/결과를 확인할 수 없다.

근거: [Cochrane Handbook](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-10)

## 36개 효과별 P·CI 판정

| 결과 | Word 문단 | P | 95% CI | 본문 판정 | 일치 |
|---|---:|---:|---|---|---|
| motor_overall_main | 33 | <0.001 | 0.313 to 0.640 | 유의한 양의 효과 | 통과 |
| motor_overall_sensitivity | 33 | <0.001 | 0.369 to 0.740 | 유의한 양의 효과 | 통과 |
| motor_athletes_main | 36 | <0.001 | 0.481 to 0.842 | 유의한 양의 효과 | 통과 |
| motor_healthy_main | 36 | =0.101 | -0.170 to 1.924 | 비유의 | 통과 |
| motor_patients_main | 36 | =0.890 | -0.284 to 0.246 | 비유의 | 통과 |
| motor_athletes_sensitivity | 36 | <0.001 | 0.484 to 0.855 | 유의한 양의 효과 | 통과 |
| motor_patients_sensitivity | 36 | =0.603 | -0.590 to 0.343 | 비유의 | 통과 |
| motor_static_main | 37 | =0.750 | -0.491 to 0.682 | 비유의 | 통과 |
| motor_dynamic_main | 37 | <0.001 | 0.305 to 0.825 | 유의한 양의 효과 | 통과 |
| motor_functional_main | 37 | <0.001 | 0.317 to 0.716 | 유의한 양의 효과 | 통과 |
| motor_static_sensitivity | 37 | =0.663 | -0.493 to 0.775 | 비유의 | 통과 |
| motor_functional_sensitivity | 37 | <0.001 | 0.412 to 0.899 | 유의한 양의 효과 | 통과 |
| motor_multiple_main | 38 | <0.001 | 0.327 to 0.683 | 유의한 양의 효과 | 통과 |
| motor_single_main | 38 | =0.159 | -0.113 to 0.695 | 비유의 | 통과 |
| motor_multiple_sensitivity | 38 | <0.001 | 0.379 to 0.784 | 유의한 양의 효과 | 통과 |
| motor_single_sensitivity | 38 | =0.096 | -0.065 to 0.801 | 비유의 | 통과 |
| motor_constant_main | 39 | <0.001 | 0.214 to 0.621 | 유의한 양의 효과 | 통과 |
| motor_variable_main | 39 | <0.001 | 0.308 to 0.868 | 유의한 양의 효과 | 통과 |
| motor_constant_sensitivity | 39 | <0.001 | 0.230 to 0.641 | 유의한 양의 효과 | 통과 |
| motor_variable_sensitivity | 39 | <0.001 | 0.525 to 1.289 | 유의한 양의 효과 | 통과 |
| cognitive_overall_main | 42 | <0.001 | 0.434 to 1.105 | 유의한 양의 효과 | 통과 |
| cognitive_overall_sensitivity | 42 | <0.001 | 0.542 to 1.223 | 유의한 양의 효과 | 통과 |
| cognitive_athletes_main | 45 | <0.001 | 0.686 to 1.457 | 유의한 양의 효과 | 통과 |
| cognitive_healthy_main | 45 | =0.471 | -1.606 to 0.743 | 비유의 | 통과 |
| cognitive_patients_main | 45 | =0.874 | -0.204 to 0.240 | 비유의 | 통과 |
| cognitive_reaction_main | 46 | <0.001 | 0.517 to 2.000 | 유의한 양의 효과 | 통과 |
| cognitive_anticipation_main | 46 | =0.036 | 0.042 to 1.199 | 유의한 양의 효과 | 통과 |
| cognitive_executive_main | 46 | =0.082 | -0.071 to 1.183 | 비유의 | 통과 |
| cognitive_visuospatial_main | 46 | =0.367 | -0.668 to 1.806 | 비유의 | 통과 |
| cognitive_anticipation_sensitivity | 46 | =0.003 | 0.299 to 1.472 | 유의한 양의 효과 | 통과 |
| cognitive_multiple_main | 47 | <0.001 | 0.721 to 1.530 | 유의한 양의 효과 | 통과 |
| cognitive_single_main | 47 | =0.730 | -0.327 to 0.229 | 비유의 | 통과 |
| cognitive_single_sensitivity | 47 | =0.691 | -0.169 to 0.255 | 비유의 | 통과 |
| cognitive_variable_main | 48 | <0.001 | 0.903 to 2.015 | 유의한 양의 효과 | 통과 |
| cognitive_constant_main | 48 | =0.224 | -0.098 to 0.420 | 비유의 | 통과 |
| cognitive_constant_sensitivity | 48 | =0.034 | 0.018 to 0.462 | 유의한 양의 효과 | 통과 |

원본 DOCX, 통계 원표, 기존 메모는 수정하지 않았다. 숫자·형식 담당의 독립 검수 결과와 교차 비교할 수 있도록 근거와 판정 범위를 구분하였다.

## 다른 검수 에이전트와의 교차 확인

수치 검수 담당은 36개 효과의 426개 수치·CI·개수·본문 검사항목에서 불일치가 없음을 독립 확인했다. 문체·형식 검수 담당과도 위 주요 해석 판정이 모두 같았다. 유의성 판정, I² 표현, Egger 과장 표현, 인지 고정 설정의 유의성 변경, 고령자 미보고, 운동 전체 민감도 규모 미기재, 소수 연구와 동일 연구 내 비교의 Egger 해석 한계, 제외 수 범위 해석에 남은 이견은 없다.
