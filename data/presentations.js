/**
 * Textes de présentation, un par jeu, affichés SOUS la scène de jeu.
 *
 * ------------------------------------------------------------------ pourquoi
 *
 * Les pages de jeu comptaient une soixantaine de mots indexables : un titre,
 * une description d'une ligne, dix intitulés de carrousel. C'est trop peu pour
 * qu'un moteur comprenne de quoi parle la page, quelles que soient ses balises.
 * Aucune optimisation d'en-tête ne compense une page vide.
 *
 * Ces blocs répondent à ça, et à une seconde chose : le joueur qui vient de
 * perdre et se demande comment progresser n'avait nulle part où aller.
 *
 * -------------------------------------------------------------------- règles
 *
 * 1. CHAQUE BLOC DIT CE QUE SEUL SON JEU PEUT DIRE. Dix textes bâtis sur le
 *    même moule, avec le nom du jeu qui change, c'est du contenu dupliqué :
 *    Google le repère et le déclasse. Le repliement d'octave n'appartient
 *    qu'aux accords, taper du pied qu'au tempo, la sonorité contre la mélodie
 *    qu'à l'instrument.
 *
 * 2. UNE TECHNIQUE RÉELLE, PAS UNE PARAPHRASE DE LA CONSIGNE. Si le texte se
 *    contente de redire la règle en plus long, il ne sert ni le joueur ni le
 *    référencement. Il doit apprendre quelque chose.
 *
 * 3. LES QUESTIONS SONT DE VRAIES QUESTIONS. Elles alimentent un balisage
 *    FAQPage, qui peut décrocher un résultat enrichi — mais seulement si
 *    elles correspondent à ce que les gens demandent vraiment. Une question
 *    inventée pour remplir le schéma est repérée comme telle.
 *
 * 4. DEUX CENTS À DEUX CENT CINQUANTE MOTS. En dessous, l'effet est nul. Au
 *    dessus, on écrit un article et la page cesse d'être un jeu.
 *
 * Un jeu sans entrée ici n'affiche simplement aucun bloc : le déploiement se
 * fait donc jeu par jeu, sans jamais rien casser.
 */
export const PRESENTATIONS = {
  tempo: {
    /* Le titre est un <h2>. Il comble au passage un trou de structure : les
       pages passaient du <h1> au <h3> du panneau sans niveau intermédiaire.

       Aucun tiret cadratin dans ces textes. Il servait à glisser une
       incise, c'est-à-dire à empiler deux idées dans une phrase déjà pleine.
       Sans lui, chaque idée prend sa propre phrase, et le texte se lit à la
       vitesse où on le pense. */
    titre: 'Comment trouver le BPM d’un morceau',
    paragraphes: [
      'Le BPM, ou battements par minute, c’est tout simplement la vitesse d’un '
      + 'morceau. C’est le rythme que ton pied trouve tout seul quand une musique te '
      + 'plaît. Presque tous les morceaux tournent entre 60 et 180 BPM, et c’est '
      + 'exactement ce que couvre le curseur du jeu.',

      'Pour le trouver, pas besoin d’avoir l’oreille absolue. Compte les pulsations '
      + 'pendant quinze secondes, puis multiplie par quatre. Quelques repères aident à '
      + 'se situer. À 60 BPM, ça bat une fois par seconde, comme la trotteuse d’une '
      + 'montre. À 90, c’est le pas d’une marche tranquille. À 120, tu es sur la '
      + 'vitesse de la plupart des morceaux de pop et de dance. Passé 150, on entre '
      + 'dans le rock rapide et l’électro.',

      'Le piège classique, c’est de se tromper du simple au double. Dans une batterie, '
      + 'la grosse caisse, la caisse claire et la charleston ne battent pas à la même '
      + 'vitesse, et il est facile de suivre la mauvaise. Si tu tombes sur 70 alors que '
      + 'le morceau te donne envie de danser, essaie 140. Et si tu trouves 160 sur une '
      + 'ballade, coupe en deux.',
    ],
    questions: [
      {
        q: 'Faut-il connaître le solfège pour trouver un BPM ?',
        r: 'Non, pas du tout. Taper du pied sur une musique, tout le monde sait le '
         + 'faire, même sans avoir jamais touché un instrument. Le jeu te demande '
         + 'seulement de reporter cette vitesse sur le curseur, puis de la comparer au '
         + 'métronome.',
      },
      {
        q: 'Comment compter un BPM sans métronome ?',
        r: 'Compte les pulsations pendant quinze secondes et multiplie par quatre. Si '
         + 'tu veux être plus précis, compte sur trente secondes et multiplie par '
         + 'deux. C’est plus long, mais une pulsation ratée pèse alors deux fois moins '
         + 'lourd dans le résultat.',
      },
      {
        q: 'À quoi ça sert de connaître le tempo d’un morceau ?',
        r: 'À enchaîner deux titres sans casser l’ambiance quand tu mixes. À caler un '
         + 'montage vidéo sur la musique. À régler un métronome pour travailler un '
         + 'morceau à l’instrument. Ou simplement à savoir si une reprise est plus '
         + 'lente que l’originale.',
      },
    ],
  },

  accords: {
    titre: 'Comment reconnaître un accord à l’oreille',
    paragraphes: [
      'Un accord, c’est trois ou quatre notes jouées en même temps. Ton oreille les '
      + 'entend comme une seule couleur, et tout le travail consiste à les séparer de '
      + 'nouveau. C’est un exercice qui se travaille, pas un don qu’on a ou qu’on n’a '
      + 'pas.',

      'Commence par les extrêmes. La note la plus grave est presque toujours la plus '
      + 'facile à chanter : fredonne-la, puis cherche-la sur la portée. Fais la même '
      + 'chose avec la plus aiguë, celle qui ressort le plus. Il ne reste alors qu’une '
      + 'ou deux notes au milieu, et le champ des possibles est devenu tout petit.',

      'Un dernier repère, et il vaut pour toute la musique. Un accord majeur sonne '
      + 'ouvert, presque joyeux. Un accord mineur sonne plus sombre, plus rentré. Tu '
      + 'entends déjà la différence sans savoir la nommer, et c’est souvent elle qui te '
      + 'dit si la note du milieu doit monter ou descendre d’un demi-ton.',
    ],
    questions: [
      {
        q: 'Faut-il savoir lire une partition ?',
        r: 'Non. Les notes se posent au clic sur la portée, et leur nom s’affiche sous '
         + 'chacune. Tu peux les faire glisser pour les ajuster, et le mode « chercher '
         + 'à l’oreille » les fait sonner au passage du curseur, ce qui revient à '
         + 'tâtonner sur un piano.',
      },
      {
        q: 'Pourquoi mes notes sont justes alors que je ne les ai pas mises dans le bon ordre ?',
        r: 'Parce qu’un accord n’a pas d’ordre. Ses notes sonnent ensemble, donc la '
         + 'colonne où tu poses ton do n’a aucune importance. En arpège, en revanche, '
         + 'les notes se jouent l’une après l’autre : là, l’ordre compte.',
      },
      {
        q: 'Que se passe-t-il si je me trompe d’octave ?',
        r: 'Tu perds peu de points. Jouer la bonne note trop haut ou trop bas n’est pas '
         + 'la même erreur que jouer une autre note, et le barème en tient compte.',
      },
    ],
  },

  rythme: {
    titre: 'Comment reproduire un rythme de mémoire',
    paragraphes: [
      'Reproduire un rythme demande deux choses : le retenir, et le rejouer au bon '
      + 'moment. La première est plus facile qu’il n’y paraît, la seconde est là où '
      + 'tout le monde se trompe.',

      'Pour retenir, dis le rythme à voix haute pendant que tu l’écoutes. « Ta, ta, '
      + 'tam » retient mieux qu’une image mentale, parce que ta bouche garde la durée '
      + 'des silences en même temps que celle des frappes. Compte aussi la grille en '
      + '« un et deux et trois et quatre et » : chaque syllabe correspond à une case, '
      + 'et tu sais alors exactement où tombent tes coups.',

      'Pour le moment, méfie-toi de la mesure d’attente. Entre l’écoute et ton tour, '
      + 'le métronome laisse passer une mesure à vide. C’est le piège numéro un : on '
      + 'frappe dès la fin de l’extrait et tout se décale. Attends que la zone passe au '
      + 'vert. Et si tu es systématiquement en retard, c’est normal au début, ton '
      + 'cerveau réagit au son au lieu d’anticiper la pulsation.',
    ],
    questions: [
      {
        q: 'Faut-il être batteur pour y arriver ?',
        r: 'Pas du tout. Taper dans ses mains sur une musique suffit. Le jeu mesure la '
         + 'régularité, pas la technique, et une frappe est comptée juste à cinquante '
         + 'millisecondes près.',
      },
      {
        q: 'Pourquoi je tape toujours un peu en retard ?',
        r: 'Parce que tu réagis au son au lieu de suivre la pulsation. La solution est '
         + 'de battre la mesure du pied pendant toute l’écoute, sans t’arrêter : ta '
         + 'main suit alors ton pied, qui lui est déjà dans le tempo.',
      },
      {
        q: 'Comment progresser d’un niveau à l’autre ?',
        r: 'Le tempo monte et la grille s’allonge à mesure que tu tiens. Le plus utile '
         + 'est de continuer à compter à voix basse même quand ça accélère : c’est le '
         + 'comptage qui lâche en premier, jamais les mains.',
      },
    ],
  },

  artiste: {
    titre: 'Comment deviner un artiste en sept essais',
    paragraphes: [
      'Ce jeu ne récompense pas la chance mais la méthode. À chaque nom proposé, sept '
      + 'colonnes se remplissent et comparent ton artiste à celui qui se cache : genre, '
      + 'pays, époque, format, sexe et nombre de streams. Chaque proposition élimine '
      + 'donc des centaines de possibilités, même quand elle est fausse.',

      'Commence par un artiste très connu et très typé. Un nom de niche ne t’apprendra '
      + 'presque rien, parce qu’il ne ressemble à personne. Un grand nom de pop des '
      + 'années 2010 place au contraire un repère au milieu de la carte, et chaque '
      + 'colonne te dit dans quelle direction chercher.',

      'Les flèches valent de l’or. Elles n’apparaissent que sur les débuts et sur les '
      + 'streams, et elles te disent de viser plus haut ou plus bas. Deux propositions '
      + 'bien choisies suffisent souvent à enfermer l’époque dans une décennie. Le reste '
      + 'devient de la déduction, pas de la culture musicale.',
    ],
    questions: [
      {
        q: 'Par quel artiste vaut-il mieux commencer ?',
        r: 'Par un nom que tout le monde connaît et qui se situe au milieu : pop, '
         + 'américain ou britannique, années 2010, beaucoup de streams. Tu obtiens '
         + 'ainsi le maximum d’informations dès le premier essai.',
      },
      {
        q: 'Que veulent dire les flèches ?',
        r: 'Elles t’indiquent de viser plus haut ou plus bas. Sur la colonne des débuts, '
         + 'cela veut dire une époque plus tardive ou plus ancienne. Sur celle des '
         + 'streams, un artiste plus écouté ou moins écouté.',
      },
      {
        q: 'Le score dépend-il du nombre d’essais ?',
        r: 'Oui. Trouver du premier coup rapporte le maximum, et chaque essai fait '
         + 'baisser la note. Mieux vaut donc réfléchir une proposition de plus que d’en '
         + 'tenter trois au hasard.',
      },
    ],
  },

  pochette: {
    titre: 'Comment reconnaître une pochette d’album floutée',
    paragraphes: [
      'Une pochette très floutée ne garde que trois choses : ses couleurs dominantes, '
      + 'la répartition des masses claires et sombres, et la présence ou non d’un '
      + 'visage. C’est peu, et c’est déjà beaucoup.',

      'Regarde d’abord la palette. Les pochettes de rap des années 2010 tirent souvent '
      + 'vers le noir et l’or, la pop des années 1980 vers les néons saturés, le folk '
      + 'vers les tons terreux. Cherche ensuite le texte : un titre en gros au centre '
      + 'n’appartient pas au même monde qu’un nom discret dans un coin. La position du '
      + 'sujet compte aussi, un portrait cadré serré ne se floute pas comme un paysage.',

      'Chaque erreur lève un peu le flou, et le pas est calculé pour que tu voies '
      + 'autant de choses nouvelles au premier essai qu’au dernier. Autant tenter tôt '
      + 'un nom probable : une réponse fausse te rapproche toujours de l’image, alors '
      + 'qu’attendre ne t’apporte rien.',
    ],
    questions: [
      {
        q: 'Faut-il connaître la pochette par cœur ?',
        r: 'Non, et c’est rarement ainsi qu’on trouve. On reconnaît d’abord une époque '
         + 'et un genre à leurs couleurs, ce qui réduit la liste des artistes possibles '
         + 'avant même de distinguer quoi que ce soit.',
      },
      {
        q: 'Que faut-il regarder en premier ?',
        r: 'Les couleurs dominantes, puis la place du texte. Ce sont les deux seules '
         + 'informations qui survivent à un flou fort, et elles suffisent souvent à '
         + 'situer la décennie.',
      },
      {
        q: 'Pourquoi certaines pochettes sont-elles beaucoup plus dures ?',
        r: 'Parce qu’une image très sombre ou très uniforme ne livre presque rien tant '
         + 'que le flou n’est pas tombé. Sur celles-là, le dernier essai débloque un '
         + 'extrait du morceau, qui devient alors le meilleur indice.',
      },
    ],
  },

  'humain-ou-ia': {
    titre: 'Comment reconnaître une musique générée par IA',
    paragraphes: [
      'Les modèles de génération musicale ont fait un bond en deux ans. Sur un extrait '
      + 'court, beaucoup de gens ne font plus la différence, et c’est précisément ce que '
      + 'ce jeu mesure. Il reste pourtant des indices, et ils s’apprennent.',

      'Écoute la voix en premier. Les consonnes sont le point faible des machines : les '
      + 's, les t et les k y sont souvent flous, comme mâchés. Les respirations '
      + 'manquent, ou tombent au mauvais endroit. Écoute ensuite les cymbales et les '
      + 'aigus, qui deviennent facilement une bouillie scintillante au lieu de coups '
      + 'nets.',

      'Un dernier indice, plus subtil : le morceau évolue-t-il ? Un vrai enregistrement '
      + 'respire, monte, retombe, laisse un instrument prendre le dessus. Une génération '
      + 'a tendance à tenir la même intensité du début à la fin, sans jamais rien '
      + 'risquer. Si tout est parfaitement lisse pendant quinze secondes, méfie-toi.',
    ],
    questions: [
      {
        q: 'Est-ce vraiment possible de faire la différence ?',
        r: 'Oui, mais de moins en moins facilement. Sur un extrait de quelques secondes, '
         + 'même des musiciens se trompent régulièrement. C’est ce qui rend l’exercice '
         + 'intéressant plutôt que décourageant.',
      },
      {
        q: 'Quels indices écouter en priorité ?',
        r: 'Les consonnes de la voix, la netteté des cymbales, et le fait que le morceau '
         + 'évolue ou non. Ne cherche pas à reconnaître le titre : les vrais morceaux '
         + 'sont souvent obscurs, et le reconnaître n’est pas la question.',
      },
      {
        q: 'Combien d’erreurs ai-je droit ?',
        r: 'Une seule en mode entraînement, et elle arrête la partie. C’est ce qui donne '
         + 'son enjeu à chaque écoute, et ce qui pousse à prendre le temps de douter.',
      },
    ],
  },

  'blind-test': {
    titre: 'Comment reconnaître un morceau en une seconde',
    paragraphes: [
      'Une seconde, c’est très court, et pourtant c’est souvent assez. La mémoire '
      + 'musicale ne fonctionne pas comme la mémoire des mots : elle reconnaît une '
      + 'texture avant de reconnaître une mélodie. Le grain d’une voix, la réverbération '
      + 'd’une caisse claire, la couleur d’un synthé suffisent parfois à faire surgir un '
      + 'titre entier.',

      'Le meilleur conseil est donc de ne pas chercher. Écoute, laisse venir, et si rien '
      + 'ne remonte, allonge. Chercher activement occupe la partie de ton cerveau qui '
      + 'analyse, alors que la reconnaissance vient de celle qui se souvient.',

      'Quand tu allonges, tu paies. Le premier essai vaut dix points, le dernier deux, '
      + 'et l’extrait passe de une à seize secondes en cinq paliers. Tout l’art du jeu '
      + 'est là : tenter un titre incertain tôt, ou attendre d’être sûr et se contenter '
      + 'de miettes. Une réponse approximative est acceptée, donc le doute sur '
      + 'l’orthographe ne doit jamais te retenir.',
    ],
    questions: [
      {
        q: 'Faut-il écrire le titre exactement ?',
        r: 'Non. Une faute ou deux passent, et une partie du titre suffit souvent. '
         + 'Écris ce que tu entends plutôt que de renoncer.',
      },
      {
        q: 'Que faire si je ne reconnais rien du tout ?',
        r: 'Propose l’artiste plutôt que le titre : il rapporte la moitié des points, et '
         + 'la partie continue. Beaucoup de morceaux se reconnaissent à une voix bien '
         + 'avant de se reconnaître à leur nom.',
      },
      {
        q: 'Jusqu’à combien de secondes peut-on aller ?',
        r: 'Seize, en cinq allongements. Les paliers sont de une, deux, quatre, sept, '
         + 'onze puis seize secondes.',
      },
    ],
  },

  instrument: {
    titre: 'Comment reconnaître un instrument à l’oreille',
    paragraphes: [
      'On croit reconnaître un instrument à sa mélodie. C’est faux, et c’est pour ça '
      + 'que l’exercice paraît difficile : ici, tous les instruments jouent le même air. '
      + 'Ce qui les distingue, c’est la manière dont le son commence.',

      'Écoute l’attaque, la toute première fraction de seconde. Une note frappée '
      + 'démarre net et s’éteint toute seule : piano, xylophone. Une note frottée monte '
      + 'progressivement et peut durer indéfiniment : violon, violoncelle. Une note '
      + 'soufflée commence par un bruit d’air avant que la hauteur s’installe : flûte, '
      + 'clarinette, trompette. Une note pincée claque puis retombe vite : guitare, '
      + 'harpe.',

      'Une fois la famille trouvée, le registre fait le reste. Un violon vit dans '
      + 'l’aigu, un violoncelle une octave plus bas, une contrebasse encore en dessous. '
      + 'Même chose chez les cuivres, de la trompette au tuba. Trouver le bon groupe '
      + 'rapporte déjà la moitié des points, ce qui vaut toujours mieux que de tenter un '
      + 'nom au hasard.',
    ],
    questions: [
      {
        q: 'Quelle différence entre les bois et les cuivres ?',
        r: 'Pas la matière, malgré les noms. Dans un bois, le son naît d’un souffle sur '
         + 'un biseau ou sur une anche. Dans un cuivre, il naît des lèvres du musicien '
         + 'qui vibrent dans une embouchure. Le saxophone est en métal mais reste un '
         + 'bois.',
      },
      {
        q: 'Comment distinguer un violon d’un violoncelle ?',
        r: 'Par la hauteur avant tout. Le violoncelle sonne une bonne octave plus bas et '
         + 'son timbre est plus rond, plus proche de la voix humaine.',
      },
      {
        q: 'Combien d’instruments sont possibles ?',
        r: 'Vingt et un, répartis en six groupes : claviers, cordes frottées, cordes '
         + 'pincées, bois, cuivres et percussions.',
      },
    ],
  },

  duel: {
    titre: 'Quel morceau a le plus de streams sur Spotify',
    paragraphes: [
      'Ce jeu ne demande pas de connaître les chiffres par cœur. Il demande de '
      + 'comprendre comment fonctionne le streaming, et cette logique s’apprend en trois '
      + 'idées.',

      'La première, et de loin la plus utile : le streaming favorise le récent. Spotify '
      + 'a ouvert en 2008 et n’a explosé qu’au milieu des années 2010. Un classique des '
      + 'années 1980, même universellement connu, part donc avec un handicap énorme face '
      + 'à un tube de 2020. C’est contre-intuitif, et c’est ce qui fait perdre la '
      + 'plupart des duels.',

      'La deuxième : les morceaux courts et faciles à enchaîner tournent mieux, parce '
      + 'que les playlists les rejouent en boucle. La troisième : un artiste avec un '
      + 'seul énorme succès concentre tout dessus, alors qu’un artiste à discographie '
      + 'large répartit ses écoutes. À notoriété égale, le morceau isolé gagne souvent.',
    ],
    questions: [
      {
        q: 'D’où viennent les chiffres de streams ?',
        r: 'Des relevés publics de kworb.net, qui agrège les compteurs officiels de '
         + 'Spotify. Ils sont donnés en millions ou en milliards selon les morceaux.',
      },
      {
        q: 'Pourquoi un classique perd-il souvent contre un morceau récent ?',
        r: 'Parce que le compteur ne mesure pas la célébrité mais les écoutes en '
         + 'streaming depuis 2008. Un morceau adoré pendant trente ans à la radio n’a '
         + 'accumulé aucun stream avant cette date.',
      },
      {
        q: 'Combien d’erreurs puis-je faire ?',
        r: 'Une seule en mode entraînement : le run s’arrête à la première mauvaise '
         + 'réponse, et l’écart entre les deux morceaux se resserre à mesure que tu '
         + 'montes.',
      },
    ],
  },

  paroles: {
    titre: 'Comment retrouver la suite d’un refrain',
    paragraphes: [
      'Trois lignes de paroles s’affichent, tu écris la quatrième. Cela semble tenir de '
      + 'la seule mémoire, et pourtant la déduction fait la moitié du travail.',

      'Chante les lignes dans ta tête plutôt que de les lire. Les paroles d’une chanson '
      + 'ne sont pas un texte, elles sont collées à une mélodie, et c’est la mélodie qui '
      + 'rappelle la suite. Le rythme des syllabes t’aide aussi : la ligne manquante a '
      + 'presque toujours la même longueur que celles qui la précèdent, et elle rime '
      + 'souvent avec l’une d’elles.',

      'Si rien ne vient, tente quand même. Chaque erreur dévoile des mots supplémentaires '
      + 'de la ligne cachée, et il suffit parfois de deux mots pour que tout le refrain '
      + 'remonte d’un coup. Le score baisse à chaque essai, mais un refrain trouvé au '
      + 'quatrième essai vaut toujours mieux qu’un refrain manqué.',
    ],
    questions: [
      {
        q: 'Faut-il écrire les paroles sans faute ?',
        r: 'Non. Une ou deux fautes sont tolérées, ce qui compte beaucoup sur des '
         + 'paroles en anglais. Écris ce que tu entends dans ta tête, même si tu doutes '
         + 'de l’orthographe.',
      },
      {
        q: 'Les paroles sont-elles toutes en anglais ?',
        r: 'Non, le catalogue mélange les langues. Mais les refrains anglophones sont '
         + 'majoritaires, comme dans la plupart des catalogues de streaming.',
      },
      {
        q: 'Que faire quand je bloque complètement ?',
        r: 'Propose n’importe quelle suite plausible. Les mots qui se dévoilent après '
         + 'une erreur sont souvent ce qui débloque la mémoire, bien plus que de rester '
         + 'à fixer les trois lignes données.',
      },
    ],
  },
};

/** Présentation d’un jeu, ou null s’il n’en a pas encore. */
export function presentationDuSlug(slug) {
  return PRESENTATIONS[slug] ?? null;
}