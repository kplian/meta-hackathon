import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import createQr from 'qrcode-generator';

// Entirely local: the one-time linking secret never goes to a QR image service.
export default function VerificationQr({ value, label }: { value: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = createQr(0, 'M'); qr.addData(value); qr.make();
    const size = qr.getModuleCount();
    const modules: string[] = [];
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col)) modules.push(`M${col + 4} ${row + 4}h1v1h-1z`);
    }
    return { path: modules.join(''), size: size + 8 };
  }, [value]);
  return <View accessibilityLabel={label} accessibilityRole="image" style={{ alignSelf: 'center' }}>
    <Svg width={220} height={220} viewBox={`0 0 ${size} ${size}`}><Rect width={size} height={size} fill="white" /><Path d={path} fill="#0B3D2E" /></Svg>
  </View>;
}
