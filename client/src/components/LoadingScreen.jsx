import S from "./pageStyles";

export function LoadingScreen({ label = "Loading your session..." }) {
  return (
    <div style={S.page}>
      <div style={S.logo}>Oguz Meeting</div>
      <p style={S.tagline}>{label}</p>
    </div>
  );
}
