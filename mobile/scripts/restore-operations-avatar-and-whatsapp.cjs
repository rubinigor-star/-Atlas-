const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'components', 'EventOperationsScreen.tsx');
let source = fs.readFileSync(file, 'utf8');

const listAvatarOld = `{order.socialProfileImageUrl\n                ? <Image source={{ uri: order.socialProfileImageUrl }} style={styles.avatarImage} />\n                : <Ionicons name={customerAvatarIcon(order)} size={27} color=\"#17213C\" />}`;
const listAvatarNew = `<Ionicons name={customerAvatarIcon(order)} size={27} color=\"#17213C\" />`;

const socialOld = `{(order.customerInstagram || order.customerFacebook) && <View style={styles.socialRow}>\n                    {!!order.customerInstagram && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerInstagram!)}><Ionicons name=\"logo-instagram\" size={14} color=\"#C13584\" /><Text style={styles.socialChipText}>Instagram</Text></TouchableOpacity>}\n                    {!!order.customerFacebook && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerFacebook!)}><Ionicons name=\"logo-facebook\" size={14} color=\"#1877F2\" /><Text style={styles.socialChipText}>Facebook</Text></TouchableOpacity>}\n                  </View>}`;
const socialNew = `{(order.customerInstagram || order.customerFacebook || order.customerPhone) && <View style={styles.socialRow}>\n                    {!!order.customerInstagram && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerInstagram!)}><Ionicons name=\"logo-instagram\" size={14} color=\"#C13584\" /><Text style={styles.socialChipText}>Instagram</Text></TouchableOpacity>}\n                    {!!order.customerFacebook && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerFacebook!)}><Ionicons name=\"logo-facebook\" size={14} color=\"#1877F2\" /><Text style={styles.socialChipText}>Facebook</Text></TouchableOpacity>}\n                    {!!order.customerPhone && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(whatsappUrl(order.customerPhone))}><Ionicons name=\"logo-whatsapp\" size={14} color=\"#168044\" /><Text style={styles.socialChipText}>WhatsApp</Text></TouchableOpacity>}\n                  </View>}`;

const sheetAvatarOld = `{selected.socialProfileImageUrl\n                ? <Image source={{ uri: selected.socialProfileImageUrl }} style={styles.sheetAvatar} />\n                : <View style={styles.sheetAvatarFallback}><Ionicons name={customerAvatarIcon(selected)} size={24} color=\"#17213C\" /></View>}`;
const sheetAvatarNew = `<View style={styles.sheetAvatarFallback}><Ionicons name={customerAvatarIcon(selected)} size={24} color=\"#17213C\" /></View>`;

for (const [name, oldText, newText] of [
  ['list avatar', listAvatarOld, listAvatarNew],
  ['social quick actions', socialOld, socialNew],
  ['sheet avatar', sheetAvatarOld, sheetAvatarNew],
]) {
  if (source.includes(newText)) continue;
  if (!source.includes(oldText)) {
    throw new Error(`Could not find ${name} block in EventOperationsScreen.tsx`);
  }
  source = source.replace(oldText, newText);
}

fs.writeFileSync(file, source);
console.log('Event operations card restored: gender icon + Instagram/Facebook/WhatsApp quick actions.');
