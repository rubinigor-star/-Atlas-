const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'components', 'EventOperationsScreen.tsx');
let source = fs.readFileSync(file, 'utf8');

// Restore the stable morning card behavior: never render a social-profile image
// in the approval avatar. The avatar is always based on the stored gender.
source = source.replace(
  /\{order\.socialProfileImageUrl\s*\?\s*<Image source=\{\{ uri: order\.socialProfileImageUrl \}\} style=\{styles\.avatarImage\} \/>\s*:\s*<Ionicons name=\{customerAvatarIcon\(order\)\} size=\{27\} color="#17213C" \/>\}/m,
  '<Ionicons name={customerAvatarIcon(order)} size={27} color="#17213C" />',
);

source = source.replace(
  /\{selected\.socialProfileImageUrl\s*\?\s*<Image source=\{\{ uri: selected\.socialProfileImageUrl \}\} style=\{styles\.sheetAvatar\} \/>\s*:\s*<View style=\{styles\.sheetAvatarFallback\}><Ionicons name=\{customerAvatarIcon\(selected\)\} size=\{24\} color="#17213C" \/><\/View>\}/m,
  '<View style={styles.sheetAvatarFallback}><Ionicons name={customerAvatarIcon(selected)} size={24} color="#17213C" /></View>',
);

// Add WhatsApp beside Instagram/Facebook without touching the rest of the card.
source = source.replace(
  /\{\(order\.customerInstagram \|\| order\.customerFacebook\) && <View style=\{styles\.socialRow\}>\s*\{!!order\.customerInstagram && <TouchableOpacity style=\{styles\.socialChip\} onPress=\{\(\) => void Linking\.openURL\(order\.customerInstagram!\)\}><Ionicons name="logo-instagram" size=\{14\} color="#C13584" \/><Text style=\{styles\.socialChipText\}>Instagram<\/Text><\/TouchableOpacity>\}\s*\{!!order\.customerFacebook && <TouchableOpacity style=\{styles\.socialChip\} onPress=\{\(\) => void Linking\.openURL\(order\.customerFacebook!\)\}><Ionicons name="logo-facebook" size=\{14\} color="#1877F2" \/><Text style=\{styles\.socialChipText\}>Facebook<\/Text><\/TouchableOpacity>\}\s*<\/View>\}/m,
  `{(order.customerInstagram || order.customerFacebook || order.customerPhone) && <View style={styles.socialRow}>\n                    {!!order.customerInstagram && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerInstagram!)}><Ionicons name="logo-instagram" size={14} color="#C13584" /><Text style={styles.socialChipText}>Instagram</Text></TouchableOpacity>}\n                    {!!order.customerFacebook && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(order.customerFacebook!)}><Ionicons name="logo-facebook" size={14} color="#1877F2" /><Text style={styles.socialChipText}>Facebook</Text></TouchableOpacity>}\n                    {!!order.customerPhone && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(whatsappUrl(order.customerPhone))}><Ionicons name="logo-whatsapp" size={14} color="#168044" /><Text style={styles.socialChipText}>WhatsApp</Text></TouchableOpacity>}\n                  </View>}`,
);

// If the social row already includes phone in its condition but is missing the button,
// insert the WhatsApp action after Facebook.
if (source.includes('order.customerInstagram || order.customerFacebook || order.customerPhone') && !source.includes('<Text style={styles.socialChipText}>WhatsApp</Text>')) {
  source = source.replace(
    /\{!!order\.customerFacebook && <TouchableOpacity style=\{styles\.socialChip\} onPress=\{\(\) => void Linking\.openURL\(order\.customerFacebook!\)\}><Ionicons name="logo-facebook" size=\{14\} color="#1877F2" \/><Text style=\{styles\.socialChipText\}>Facebook<\/Text><\/TouchableOpacity>\}/,
    `$&\n                    {!!order.customerPhone && <TouchableOpacity style={styles.socialChip} onPress={() => void Linking.openURL(whatsappUrl(order.customerPhone))}><Ionicons name="logo-whatsapp" size={14} color="#168044" /><Text style={styles.socialChipText}>WhatsApp</Text></TouchableOpacity>}`,
  );
}

// Remove now-unused Image import and image-only styles from the morning card.
source = source.replace(/^\s*Image,\n/m, '');
source = source.replace(/^\s*avatarImage: \{[^\n]*\},\n/m, '');
source = source.replace(/^\s*sheetAvatar: \{[^\n]*\},\n/m, '');

const failures = [];
if (source.includes('order.socialProfileImageUrl')) failures.push('list avatar still uses socialProfileImageUrl');
if (source.includes('selected.socialProfileImageUrl')) failures.push('sheet avatar still uses socialProfileImageUrl');
if (!source.includes('name={customerAvatarIcon(order)}')) failures.push('gender avatar missing');
if (!source.includes('<Text style={styles.socialChipText}>WhatsApp</Text>')) failures.push('WhatsApp quick action missing');

if (failures.length) {
  throw new Error(`Restore failed: ${failures.join('; ')}`);
}

fs.writeFileSync(file, source);
console.log('Event operations restored to morning avatar behavior + WhatsApp quick action.');
