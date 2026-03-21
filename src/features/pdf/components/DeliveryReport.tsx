import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { Delivery, Driver } from "@/shared/types/delivery";

Font.register({
  family: "NotoSansJP",
  src: "https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf",
});

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "NotoSansJP", fontSize: 9 },
  header: { marginBottom: 15 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  table: { width: "100%", marginTop: 10 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1px solid #d1d5db",
    padding: 4,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    padding: 4,
  },
  col1: { width: "14%" },
  col2: { width: "5%" },
  col3: { width: "6%" },
  col4: { width: "5%" },
  col5: { width: "20%" },
  col6: { width: "6%" },
  col7: { width: "9%" },
  col8: { width: "9%" },
  col9: { width: "10%" },
  col10: { width: "4%" },
  col11: { width: "12%" },
});

type Props = {
  deliveries: Delivery[];
  drivers: Driver[];
  date: string;
};

export function DeliveryReport({ deliveries, drivers, date }: Props) {
  const grouped = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    const key = d.driverName || "未割当";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }

  return (
    <Document>
      {Array.from(grouped.entries()).map(([driverName, items]) => {
        const driver = drivers.find((d) => d.name === driverName);
        const totalWeight = items.reduce((s, d) => s + d.actualWeight, 0);
        const totalVolume = items.reduce((s, d) => s + d.volume, 0);

        return (
          <Page key={driverName} size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>{driverName}</Text>
              <Text style={styles.subtitle}>
                {date} | {items.length}件 | 重量合計: {totalWeight}kg | 容積合計: {totalVolume}L
                {driver ? ` | 車両: ${driver.vehicleType === "2t" ? "2tトラック" : "軽自動車"}` : ""}
              </Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>届先名</Text>
                <Text style={styles.col2}>個口数</Text>
                <Text style={styles.col3}>実重量</Text>
                <Text style={styles.col4}>容積</Text>
                <Text style={styles.col5}>届先住所</Text>
                <Text style={styles.col6}>納品日</Text>
                <Text style={styles.col7}>伝票番号</Text>
                <Text style={styles.col8}>出荷番号</Text>
                <Text style={styles.col9}>担当者</Text>
                <Text style={styles.col10}>未配</Text>
                <Text style={styles.col11}>メモ</Text>
              </View>
              {items.map((d) => (
                <View key={d.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{d.destinationName}</Text>
                  <Text style={styles.col2}>{d.packageCount}</Text>
                  <Text style={styles.col3}>{d.actualWeight}kg</Text>
                  <Text style={styles.col4}>{d.volume}L</Text>
                  <Text style={styles.col5}>{d.address}</Text>
                  <Text style={styles.col6}>{d.deliveryDate}</Text>
                  <Text style={styles.col7}>{d.slipNumber}</Text>
                  <Text style={styles.col8}>{d.shippingNumber}</Text>
                  <Text style={styles.col9}>{d.driverName || "未割当"}</Text>
                  <Text style={styles.col10}>{d.isUndelivered ? "○" : ""}</Text>
                  <Text style={styles.col11}>{d.memo}</Text>
                </View>
              ))}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
