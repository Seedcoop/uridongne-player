# 우리 동네 플레이어 · 게임 상상 연구소

아이들이 일상에서 찾은 소재를 8단계 질문으로 구체화하고, 5,000자 이상의 AI 게임 제작 프롬프트를 완성하는 웹앱입니다.

- 8단계 페이지 이동과 직접 입력·예시 선택
- 일상, 장소·이야기, 주인공, 목표·조작, 규칙, 화면, 그림·소리, 시험 플레이
- 답변 자동 저장, 아이디어 JSON 저장·불러오기
- 전체 제작 프롬프트 복사, TXT 저장, 아이디어 요약 저장
- 팀이 정한 답변과 미작성 항목의 제안 기본값 구분
- PC·휴대폰 화면 지원

## GitHub Pages 배포

저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다. `main`에 변경을 올리면 `.github/workflows/deploy-pages.yml`이 `dist` 폴더를 자동 배포합니다.

배포 주소: <https://seedcoop.github.io/uridongne-player/>

## 로컬 실행

Node.js가 있는 환경에서 설치할 추가 패키지 없이 실행합니다.

```sh
npm start
```

<http://127.0.0.1:4178/>를 엽니다. 브라우저 모듈을 사용하므로 HTML 파일을 직접 더블클릭하는 대신 위 실행 방법을 사용합니다.

## 파일 구성

```text
dist/
  index.html          # 화면
  styles.css          # 디자인
  app.js              # 단계 이동·저장·복사
  questions.js        # 43개 질문과 예시 답변
  prompt-builder.js   # 상세 제작 프롬프트 생성
  assets/             # 포스터와 아이콘
server.mjs            # 로컬 확인용 서버
.github/workflows/    # GitHub Pages 자동 배포
```

질문과 예시는 `dist/questions.js`, 공통 제작 규격은 `dist/prompt-builder.js`에서 수정합니다. 실제 게임 개발과 작품의 공개·배포 준비는 멘토와 운영팀이 진행합니다.

## 자료와 저장

포스터 이미지는 프로젝트에서 제공한 시각 참고 자료입니다. 다른 프로젝트에 이미지를 재사용할 때는 원본 사용 범위를 확인해 주세요. 코드에 별도의 오픈소스 라이선스는 지정하지 않았습니다.

답변은 사용자 브라우저에 저장되며 서버에 전송하지 않습니다. 기기를 바꾸기 전에 아이디어 파일을 저장하세요. GitHub 저장소에는 팀별 개인 답변, 계정 정보, 비공개 Sites 설정을 포함하지 않습니다.
