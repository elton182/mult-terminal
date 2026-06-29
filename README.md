# multerm

Gerenciador de múltiplos terminais para Windows, Linux e macOS. Construído com **Tauri 2** (Rust) + **Vue 3** + **xterm.js**.

## Funcionalidades

- **Terminais locais** — CMD, PowerShell, WSL, Bash, Zsh, Fish
- **SSH integrado** — conexão por senha ou chave privada, perfis salvos
- **Transferência de arquivos** — painel dual-pane (local + remoto) via **SFTP** e **FTP**
- **Layout em grade flexível** — colunas com linhas variáveis (ex: 2+3+1 = 6 terminais simultâneos)
- **Redimensionamento de painéis** — arraste os divisores entre terminais
- **Atalhos de teclado** — navegação e controle sem mouse
- **Tema dark** inspirado no GitHub Dark
- **Ícone nativo** e integração com o Windows (auto-start, atalho no desktop)

## Instalação e execução

### Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- [Rust (via rustup)](https://rustup.rs)
- Windows: Microsoft C++ Build Tools + WebView2 (já incluso no Windows 10/11)
- Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev`

### Desenvolvimento

```bash
git clone <repo>
cd multerm
npm install
npm run tauri dev
```

### Build de produção

```bash
npm run tauri build
# Gera instalador em: src-tauri/target/release/bundle/
```

## Atalhos de teclado

| Tecla | Ação |
|-------|------|
| `Ctrl+B` → `t` | Novo terminal (modal de seleção) |
| `Ctrl+B` → `w` | Fechar terminal ativo |
| `Ctrl+B` → `n` / `p` | Próximo / anterior terminal |
| `Ctrl+B` → `1` … `6` | Presets de layout |
| `Ctrl+B` → `,` | Configurações |

## Layouts disponíveis

```
[1]       [1,1]     [2,1]     [1,2]
┌───┐     ┌──┬──┐   ┌──┬──┐   ┌──┬──┐
│   │     │  │  │   │  │  │   │  │  │
│   │     │  │  │   ├──┤  │   │  ├──┤
└───┘     └──┴──┘   │  │  │   │  │  │
                    └──┴──┘   └──┴──┘

[2,3,1]              [3,3]
┌──┬──┬──┐           ┌──┬──┐
│  │  │  │           │  │  │
├──┤  └──┘           ├──┼──┤
│  ├──┤              │  │  │
└──┤  │              ├──┼──┤
   └──┘              │  │  │
                     └──┴──┘
```

## Perfis remotos (SSH / FTP)

1. Clique em **🔒** na toolbar
2. Clique em **+ Novo perfil**
3. Escolha o protocolo:
   - **SSH** — terminal + SFTP (porta 22)
   - **FTP** — somente arquivos (porta 21)
4. Preencha host, porta, usuário e autenticação
5. Salve e use:
   - **▶** — abre terminal SSH (perfis SSH)
   - **📁** — abre painel de arquivos (SFTP ou FTP)

Senhas não são persistidas em disco — são pedidas a cada conexão.

Perfis salvos em:

```
%APPDATA%\com.multerm.dev\ssh-profiles.json   # Windows
~/.config/com.multerm.dev/ssh-profiles.json   # Linux/macOS
```

## Transferência de arquivos

Painel dual-pane com listas **Local** e **Remoto**.

### Como abrir

| Origem | Ação |
|--------|------|
| Terminal SSH conectado | **📁** no header do painel (reutiliza a sessão SSH para SFTP) |
| Lista de perfis | **📁** no perfil (SFTP ou FTP direto) |

### Operações

- **↑ Enviar** / **↓ Baixar** — transferência do arquivo selecionado
- **+ Pasta remota** — cria diretório no servidor
- **✕ Remover remoto** — exclui arquivo ou pasta selecionada
- Duplo-clique em pasta — entra no diretório
- Barra de caminho editável — digite um caminho (ex: `/var/www/` ou `C:\Users\...`) e pressione **Enter** ou **→**
- Barra de progresso — exibida durante upload/download com percentual

## Estrutura do projeto

```
multerm/
├── src/                         # Frontend Vue 3
│   ├── components/              # Componentes UI (incl. FileTransferPanel)
│   ├── composables/             # Lógica reutilizável (xterm, teclado)
│   ├── stores/                  # Estado global (Pinia)
│   └── types/                   # TypeScript types
└── src-tauri/                   # Backend Rust
    └── src/
        ├── pty/                 # Gerenciador de processos PTY
        ├── ssh/                 # Cliente SSH (russh)
        ├── transfer/            # SFTP + FTP (russh-sftp, suppaftp)
        └── config/              # Modelos de configuração
```

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| App shell | Tauri 2 |
| Backend | Rust — `portable-pty`, `russh`, `russh-sftp`, `suppaftp` |
| Frontend | Vue 3 + Vite + TypeScript |
| Terminal UI | xterm.js |
| Layout | splitpanes |
| Estado | Pinia |
| Persistência | tauri-plugin-store |

## Licença

MIT
