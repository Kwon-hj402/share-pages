# 운동과 혈관 기능 논문 읽기

사용자가 제공한 PDF 네 편의 영어 Abstract 본문 전체 한글 번역, 간단 리뷰, 사전 개념, 전체 원문을 함께 읽는 정적 웹페이지입니다.

- `#moon`: 기구 필라테스 / 장유진·박원범·이만균, 2023
- `#ku`: 체중부하 서킷 운동 / 장용우·하일빈, 2023
- `#ryu`: 반복 스프린트와 지속 운동 / 홍혜림 외, 2024
- `#yebin`: 초미세먼지와 일회성 운동 / 김진수·황문현, 2021
- `#compare`: 네 논문 비교
- `#basics`: 공통 사전 개념

## 자료 기준

2026-10-28 제공 파일 기준. 파일명에 있는 인물명과 원문의 실제 저자명은 구분했습니다. 번역은 영어 원문 진술을 유지하며, 초록·본문·표 사이의 보고 차이와 해석상 한계는 리뷰에 별도로 표시했습니다. 쪽수는 인쇄 페이지가 아닌 PDF 파일의 물리적 페이지입니다.

원문 PDF 4편은 제공된 파일 그대로 보존했습니다. 저자·저작권 및 이용허락은 각 원문의 표시를 따릅니다. 리뷰와 번역은 원문 저자가 작성한 문서와 구분됩니다.

## 구동

`index.html`, `styles.css`, `data.js`, `app.js`, `papers/`, `vendor/`를 같은 위치에 두고 정적 HTTP 서버 또는 GitHub Pages에서 제공합니다. PDF 모듈과 worker를 사용하는 페이지이므로 로컬 파일을 직접 여는 대신 HTTP로 접속하세요. 외부 글꼴이 로드되지 않으면 시스템 글꼴로 표시합니다.

PDF 표시에는 Mozilla PDF.js를 사용합니다. 해당 구성요소의 라이선스는 `vendor/pdfjs/LICENSE`에 포함했습니다.

## 공통 개념 참고 자료

- Thijssen et al. (2019), Expert consensus and evidence-based recommendations for the assessment of flow-mediated dilation in humans. https://pubmed.ncbi.nlm.nih.gov/31211361/
- Thijssen et al. (2011), Assessment of flow-mediated dilation in humans. https://pmc.ncbi.nlm.nih.gov/articles/PMC3023245/
- Townsend et al. (2015), Recommendations for Improving and Standardizing Vascular Research on Arterial Stiffness. https://pmc.ncbi.nlm.nih.gov/articles/PMC4587661/
