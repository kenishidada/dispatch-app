import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { Delivery, Course } from "@/shared/types/delivery";

Font.register({
  family: "NotoSansJP",
  src: "https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf",
});

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "NotoSansJP", fontSize: 8, color: "#000" },
  header: { marginBottom: 6 },
  headerTitle: { fontSize: 11, fontWeight: "bold" },
  headerMeta: { fontSize: 8, color: "#333", marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    borderBottom: "1px solid #333",
    paddingTop: 3,
    paddingBottom: 3,
    fontWeight: "bold",
  },
  row: { flexDirection: "row", paddingTop: 2.5, paddingBottom: 2.5 },
  c_name: { width: "14%", paddingRight: 3 },
  c_pkg: { width: "5%", paddingRight: 3, textAlign: "right" },
  c_weight: { width: "7%", paddingRight: 3, textAlign: "right" },
  c_volume: { width: "6%", paddingRight: 3, textAlign: "right" },
  c_address: { width: "22%", paddingRight: 3 },
  c_date: { width: "8%", paddingRight: 3 },
  c_slip: { width: "9%", paddingRight: 3 },
  c_ship: { width: "9%", paddingRight: 3 },
  c_course: { width: "8%", paddingRight: 3 },
  c_undelivered: { width: "4%", textAlign: "center" },
  c_memo: { width: "8%" },
});

type Props = {
  deliveries: Delivery[];
  courses: Course[];
  date: string;
};

export function DeliveryReport({ deliveries, courses, date }: Props) {
  const grouped = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    const key = d.courseId ?? "__unassigned__";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }

  // 表示順: 軽（名前昇順）→ 2t（名前昇順）→ 未割当を最後
  const rank = (id: string) => {
    if (id === "__unassigned__") return { group: 2, name: "" };
    const c = courses.find((x) => x.id === id);
    return { group: c?.vehicleType === "2t" ? 1 : 0, name: c?.name ?? id };
  };
  const entries = Array.from(grouped.entries()).sort(([a], [b]) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra.group !== rb.group) return ra.group - rb.group;
    return ra.name.localeCompare(rb.name, "ja");
  });

  return (
    <Document>
      {entries.map(([courseId, items]) => {
        const course = courses.find((c) => c.id === courseId);
        const displayName = course?.name ?? "未割当";
        const totalWeight = items.reduce((s, d) => s + d.actualWeight, 0);
        const totalVolume = items.reduce((s, d) => s + d.volume, 0);

        return (
          <Page key={courseId} size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{displayName}</Text>
              <Text style={styles.headerMeta}>
                {date}　{items.length}件　重量合計 {totalWeight}kg　容積合計 {totalVolume}L
                {course ? `　車両 ${course.vehicleType === "2t" ? "2tトラック" : "軽自動車"}` : ""}
              </Text>
            </View>

            <View style={styles.headerRow}>
              <Text style={styles.c_name}>届先名</Text>
              <Text style={styles.c_pkg}>個口</Text>
              <Text style={styles.c_weight}>実重量</Text>
              <Text style={styles.c_volume}>容積</Text>
              <Text style={styles.c_address}>届先住所</Text>
              <Text style={styles.c_date}>納品日</Text>
              <Text style={styles.c_slip}>伝票番号</Text>
              <Text style={styles.c_ship}>出荷番号</Text>
              <Text style={styles.c_course}>担当コース</Text>
              <Text style={styles.c_undelivered}>未配</Text>
              <Text style={styles.c_memo}>メモ</Text>
            </View>

            {items.map((d) => {
              const dCourse = courses.find((c) => c.id === d.courseId);
              return (
                <View key={d.id} style={styles.row}>
                  <Text style={styles.c_name}>{d.destinationName}</Text>
                  <Text style={styles.c_pkg}>{d.packageCount}</Text>
                  <Text style={styles.c_weight}>{d.actualWeight}</Text>
                  <Text style={styles.c_volume}>{d.volume}</Text>
                  <Text style={styles.c_address}>{d.address}</Text>
                  <Text style={styles.c_date}>{d.deliveryDate}</Text>
                  <Text style={styles.c_slip}>{d.slipNumber}</Text>
                  <Text style={styles.c_ship}>{d.shippingNumber}</Text>
                  <Text style={styles.c_course}>{dCourse?.name ?? "未割当"}</Text>
                  <Text style={styles.c_undelivered}>{d.isUndelivered ? "○" : ""}</Text>
                  <Text style={styles.c_memo}>{d.memo}</Text>
                </View>
              );
            })}
          </Page>
        );
      })}
    </Document>
  );
}
